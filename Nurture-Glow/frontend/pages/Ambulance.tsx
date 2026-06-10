import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  AlertCircle, Phone, ArrowLeft, Shield, MapPin, CheckCircle, Navigation, Info, Star 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslations } from '../i18n/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/db';
import { apiFetch } from '../services/api';

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const Ambulance: React.FC = () => {
  const { user } = useAuth();
  const { t, locale } = useTranslations();
  const navigate = useNavigate();

  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [driverDetails, setDriverDetails] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [patientLocation, setPatientLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const mapLayersGroupRef = useRef<L.LayerGroup | null>(null);

  // Load hospitals & active trip
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      try {
        const hospList = await db.getHospitals();
        setHospitals(hospList || []);

        const meta = await db.getUserMeta(user.id, ['preferred_hospital']);
        if (meta.preferred_hospital) {
          setSelectedHospital(meta.preferred_hospital);
        }

        const activeTripData = await apiFetch<any>('/api/ambulance/active-trip');
        if (activeTripData && activeTripData.trip) {
          setActiveTrip(activeTripData.trip);
          setDriverDetails(activeTripData.driverDetails);
          if (activeTripData.trip.patientLat && activeTripData.trip.patientLng) {
            setPatientLocation({
              lat: activeTripData.trip.patientLat,
              lng: activeTripData.trip.patientLng
            });
          }
        }
      } catch (err) {
        console.error('Failed to initialize ambulance page:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user]);

  // Connect patient to WebSocket
  useEffect(() => {
    if (!user || !activeTrip || !['PENDING', 'EN_ROUTE', 'ARRIVED'].includes(activeTrip.status)) {
      setDriverLocation(null);
      setDriverDetails(null);
      return;
    }

    const token = localStorage.getItem('ng_auth_token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname || 'localhost';
    const wsUrl = `${protocol}//${hostname}:4000/ws/ambulance?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'driver-location') {
          setDriverLocation({ lat: data.lat, lng: data.lng });

          if (activeTrip.patientLat && activeTrip.patientLng) {
            const distance = getDistance(
              activeTrip.patientLat,
              activeTrip.patientLng,
              data.lat,
              data.lng
            );
            setEta(Math.ceil(distance * 3));
          }
        } else if (data.type === 'trip-accepted') {
          setActiveTrip((prev: any) => prev ? { ...prev, status: 'EN_ROUTE' } : null);
          setDriverDetails(data.driver);
        } else if (data.type === 'status-change') {
          if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
            setActiveTrip(null);
            setDriverLocation(null);
            setDriverDetails(null);
            setEta(null);
          } else {
            setActiveTrip((prev: any) => prev ? { ...prev, status: data.status } : null);
          }
        }
      } catch (err) {
        console.error('Error handling patient WS message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [user, activeTrip]);

  // Leaflet Map tracker for Patient
  useEffect(() => {
    if (!activeTrip || !mapRef.current) {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      return;
    }

    const patientLat = activeTrip.patientLat || patientLocation?.lat;
    const patientLng = activeTrip.patientLng || patientLocation?.lng;

    if (!patientLat || !patientLng) return;

    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapRef.current, {
        center: [patientLat, patientLng],
        zoom: 14,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMapRef.current);

      mapLayersGroupRef.current = L.layerGroup().addTo(leafletMapRef.current);
    }

    const map = leafletMapRef.current;
    const layerGroup = mapLayersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const patientIcon = L.icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const ambulanceIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/1048/1048329.png',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    L.marker([patientLat, patientLng], { icon: patientIcon })
      .bindPopup('Your Location')
      .addTo(layerGroup);

    const bounds: any[] = [[patientLat, patientLng]];

    if (driverLocation) {
      L.marker([driverLocation.lat, driverLocation.lng], { icon: ambulanceIcon })
        .bindPopup('Approaching Ambulance')
        .addTo(layerGroup);
      bounds.push([driverLocation.lat, driverLocation.lng]);

      (L as any).polyline([
        [patientLat, patientLng],
        [driverLocation.lat, driverLocation.lng]
      ], { color: '#ef4444', weight: 4, dashArray: '5, 10' }).addTo(layerGroup);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds as any, { padding: [40, 40] } as any);
    } else {
      map.setView([patientLat, patientLng], 14);
    }
    
    // Invalidate map size to make sure Leaflet resizes correctly when container renders
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [activeTrip, driverLocation, patientLocation]);

  const handleHospitalChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedHospital(value);
    if (!user) return;
    try {
      await db.setUserMeta(user.id, { preferred_hospital: value });
    } catch (err) {
      console.error('Failed to update preferred hospital:', err);
    }
  };

  const handleTriggerEmergency = () => {
    if (!selectedHospital) {
      alert(locale === 'bn' ? 'দয়া করে প্রথমে আপনার পছন্দের হাসপাতালটি নির্বাচন করুন।' : 'Please select your preferred destination hospital first so drivers know where to transport you.');
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setRequesting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setPatientLocation({ lat, lng });

        try {
          const res = await apiFetch<any>('/api/ambulance/request', {
            method: 'POST',
            body: JSON.stringify({
              lat,
              lng,
              destinationHospital: selectedHospital
            })
          });
          if (res.trip) {
            setActiveTrip(res.trip);
          }
        } catch (err: any) {
          alert(err.message || 'Failed to request emergency transport.');
        } finally {
          setRequesting(false);
        }
      },
      (err) => {
        alert('Could not retrieve your current location. Please check browser location permissions and try again.');
        console.error(err);
        setRequesting(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCancelEmergency = async () => {
    if (!activeTrip) return;
    const confirmMsg = locale === 'bn' 
      ? 'আপনি কি নিশ্চিত যে আপনি আপনার জরুরি অ্যাম্বুলেন্স অনুরোধ বাতিল করতে চান?' 
      : 'Are you sure you want to cancel your emergency transport request?';
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiFetch('/api/ambulance/cancel', {
        method: 'POST',
        body: JSON.stringify({ tripId: activeTrip.id })
      });
      setActiveTrip(null);
      setDriverDetails(null);
      setDriverLocation(null);
      setEta(null);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel emergency request.');
    }
  };

  // Helper to render star ratings
  const renderStars = (rating: number) => {
    const stars = [];
    const floor = Math.floor(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= floor) {
        stars.push(<Star key={i} size={11} className="fill-amber-400 text-amber-400 mr-0.5" />);
      } else if (i === floor + 1 && rating % 1 >= 0.5) {
        stars.push(
          <div key={i} className="relative inline-block mr-0.5">
            <Star size={11} className="text-gray-200" />
            <div className="absolute top-0 left-0 overflow-hidden w-1/2">
              <Star size={11} className="fill-amber-400 text-amber-400" />
            </div>
          </div>
        );
      } else {
        stars.push(<Star key={i} size={11} className="text-gray-200 mr-0.5" />);
      }
    }
    return stars;
  };

  const normalizedDriver = driverDetails ? {
    name: driverDetails.name || driverDetails.full_name || (locale === 'bn' ? 'অ্যাম্বুলেন্স চালক' : 'Ambulance Driver'),
    phone: driverDetails.phone || '',
    vehicleNumber: driverDetails.vehicleNumber || driverDetails.vehicle_number || 'NG-AMB-9999',
    vehicleType: driverDetails.vehicleType || driverDetails.vehicle_type || (locale === 'bn' ? 'প্রিমিয়াম আইসিইউ অ্যাম্বুলেন্স' : 'Premium ICU Ambulance'),
    rating: parseFloat(driverDetails.rating) || 4.95,
    avatar: driverDetails.avatar || `https://picsum.photos/seed/${driverDetails.id || 'driver'}/100/100`
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F7F5EF]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-5.2rem)] bg-[#F7F5EF] p-4 md:p-5 flex flex-col overflow-hidden max-w-full">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
        
        {/* Navigation & Header */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-full bg-white hover:bg-gray-100 text-gray-700 shadow-sm border border-gray-150 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="text-[9px] font-extrabold text-red-500 uppercase tracking-widest block leading-none">
              {locale === 'bn' ? 'জরুরি সেবা' : 'Emergency Services'}
            </span>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight mt-0.5 leading-none">
              {locale === 'bn' ? 'মাতৃত্বকালীন অ্যাম্বুলেন্স ডিসপ্যাচ' : 'Maternal Ambulance Dispatch'}
            </h1>
          </div>
        </div>

        {/* Informative Disclaimer */}
        <div className="bg-amber-50/70 border border-amber-200/50 rounded-2xl p-3 flex items-start gap-3 shadow-sm backdrop-blur-sm shrink-0">
          <div className="p-2 bg-amber-100/80 text-amber-700 rounded-xl">
            <Shield size={16} />
          </div>
          <div className="space-y-0.5">
            <h3 className="font-bold text-amber-800 text-xs">
              {locale === 'bn' ? 'নিরাপত্তা ও গোপনীয়তা গ্যারান্টি' : 'Privacy & Security Guarantee'}
            </h3>
            <p className="text-[10px] text-amber-700/90 leading-relaxed">
              {locale === 'bn' 
                ? 'আপনার চিকিৎসা বিবরণ (সপ্তাহের সংখ্যা, জটিলতা, ইত্যাদি) গোপন রাখা হয়েছে। চালক শুধুমাত্র আপনার যোগাযোগের ফোন নম্বর এবং পিকআপ জিপিএস অবস্থান দেখতে পাবেন।'
                : 'Your medical details (complications, weeks of pregnancy, heart rate) are completely hidden. The driver only receives your name, phone number, and GPS coordinates for routing.'}
            </p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden pb-2">
          
          {/* Left Panel: Request & Booking Controls */}
          <div className="lg:col-span-5 flex flex-col gap-4 min-h-0 overflow-y-auto custom-scrollbar pr-1">
            
            {/* Booking Card */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-150 relative overflow-hidden shrink-0">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                    {locale === 'bn' ? 'জরুরি ডিসপ্যাচ নিয়ন্ত্রণ' : 'Emergency Dispatch Hub'}
                  </span>
                </div>

                {!activeTrip ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                        {locale === 'bn' ? 'পছন্দের গন্তব্য হাসপাতাল' : 'Preferred Destination Hospital'}
                      </label>
                      <select
                        value={selectedHospital}
                        onChange={handleHospitalChange}
                        className="w-full bg-gray-50/80 border border-gray-200 rounded-xl p-3 text-xs font-semibold text-gray-700 focus:outline-none focus:border-red-400 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">{locale === 'bn' ? '-- গন্তব্য হাসপাতাল নির্বাচন করুন --' : '-- Select Destination Hospital --'}</option>
                        {hospitals.map((hosp) => (
                          <option key={hosp.id || hosp.name} value={hosp.name}>
                            {hosp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col items-center py-2">
                      <button
                        onClick={handleTriggerEmergency}
                        disabled={requesting}
                        className="w-32 h-32 rounded-full bg-gradient-to-br from-red-500 via-red-600 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:from-red-300 disabled:to-red-400 text-white font-extrabold text-center flex flex-col items-center justify-center shadow-lg shadow-red-150 hover:shadow-xl hover:scale-105 transition-all relative overflow-hidden group cursor-pointer"
                      >
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-25 animate-ping" />
                        <AlertCircle size={28} className="mb-1 text-white animate-bounce" />
                        <span className="text-[9px] tracking-wider uppercase font-black">
                          {requesting ? (locale === 'bn' ? 'খোঁজা হচ্ছে...' : 'Locating...') : (locale === 'bn' ? 'এক ট্যাপে' : 'One-Tap')}
                        </span>
                        <span className="text-sm font-black tracking-wider uppercase">
                          {locale === 'bn' ? 'অ্যাম্বুলেন্স' : 'Ambulance'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // Active trip container
                  <div className="space-y-4">
                    <div className="bg-red-50/50 rounded-xl p-3 border border-red-100 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">
                          {locale === 'bn' ? 'অনুরোধের অবস্থা' : 'Booking Status'}
                        </p>
                        <h4 className="text-sm font-black text-red-700 uppercase mt-0.5">
                          {activeTrip.status}
                        </h4>
                      </div>
                      {eta !== null && (
                        <div className="text-right">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            {locale === 'bn' ? 'আনুমানিক সময়' : 'Estimated ETA'}
                          </p>
                          <h4 className="text-sm font-black text-gray-800 mt-0.5">
                            {eta} {locale === 'bn' ? 'মিনিট' : 'Mins'}
                          </h4>
                        </div>
                      )}
                    </div>

                    {normalizedDriver ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                          <img 
                            src={normalizedDriver.avatar} 
                            alt={normalizedDriver.name} 
                            className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-sm"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-extrabold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-100 inline-block mb-0.5">
                              {normalizedDriver.vehicleType}
                            </span>
                            <h4 className="font-extrabold text-gray-850 text-xs truncate leading-none">
                              {normalizedDriver.name}
                            </h4>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="flex items-center">
                                {renderStars(normalizedDriver.rating)}
                              </span>
                              <span className="text-[10px] font-black text-amber-600">
                                {normalizedDriver.rating.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-gray-400 font-bold">{locale === 'bn' ? 'অ্যাম্বুলেন্স প্লেট নম্বর' : 'Vehicle Plate'}</span>
                            <span className="font-black text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded text-right">{normalizedDriver.vehicleNumber}</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-gray-400 font-bold">{locale === 'bn' ? 'চালকের সাথে যোগাযোগ' : 'Driver Phone'}</span>
                            <span className="font-extrabold text-teal-600 text-right">{normalizedDriver.phone}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <a
                            href={`tel:${normalizedDriver.phone}`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-100 hover:bg-red-200 text-red-750 rounded-xl text-xs font-black transition-all border border-red-200"
                          >
                            <Phone size={12} /> {locale === 'bn' ? 'কল করুন' : 'Call Driver'}
                          </a>
                          <button
                            onClick={handleCancelEmergency}
                            className="px-3 py-2.5 bg-white hover:bg-red-50 text-red-500 rounded-xl text-xs font-black transition-all border border-gray-250 hover:border-red-200 cursor-pointer"
                          >
                            {locale === 'bn' ? 'বাতিল' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 py-2 text-center">
                        <div className="inline-flex p-2.5 rounded-full bg-red-50 text-red-500 animate-pulse">
                          <Navigation size={20} className="animate-spin" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-extrabold text-gray-700 text-xs">
                            {locale === 'bn' ? 'চালকের জন্য খোঁজ করা হচ্ছে...' : 'Searching for operational drivers...'}
                          </p>
                          <p className="text-[9px] text-gray-450 leading-none">
                            {locale === 'bn' 
                              ? 'নিকটবর্তী চালকদের সিস্টেমে পাঠানো হয়েছে।'
                              : 'Request pushed to active units.'}
                          </p>
                        </div>
                        <button
                          onClick={handleCancelEmergency}
                          className="w-full py-2.5 bg-white hover:bg-red-50 text-red-500 rounded-xl text-xs font-black transition-all border border-gray-200 hover:border-red-200 cursor-pointer"
                        >
                          {locale === 'bn' ? 'অনুরোধ বাতিল করুন' : 'Cancel Request'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Hospital Directory Link */}
            <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-[24px] p-5 text-white shadow-sm border border-teal-500/20 shrink-0">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <MapPin size={16} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs">
                    {locale === 'bn' ? 'হাসপাতাল ডিরেক্টরি প্রয়োজন?' : 'Looking for specific maternity wings?'}
                  </h4>
                  <p className="text-[10px] text-white/80 leading-relaxed">
                    {locale === 'bn'
                      ? 'আমাদের পার্টনার হাসপাতালের পূর্ণ তালিকা দেখতে পারেন যা বিশেষ প্রসবোত্তর সেবা প্রদান করে।'
                      : 'Browse partner hospitals containing available ICU layouts.'}
                  </p>
                  <button 
                    onClick={() => navigate('/hospitals')}
                    className="text-[10px] font-black text-[#E6C77A] hover:underline flex items-center gap-1 pt-0.5 cursor-pointer bg-transparent border-none p-0 align-baseline"
                  >
                    {locale === 'bn' ? 'হাসপাতালের তালিকা দেখুন' : 'Browse Partner Hospitals'} &rarr;
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Right Panel: Interactive Leaflet Map tracking */}
          <div className="lg:col-span-7 bg-white rounded-[24px] p-5 shadow-sm border border-gray-150 flex flex-col min-h-0">
            <div className="flex items-center justify-between shrink-0 mb-3">
              <div className="flex items-center gap-2">
                <Navigation size={14} className="text-teal-600" />
                <h3 className="font-black text-gray-800 text-xs">
                  {locale === 'bn' ? 'লাইভ ট্র্যাকিং ম্যাপ' : 'Live Incident Tracking Map'}
                </h3>
              </div>
              {activeTrip && (
                <span className="text-[9px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 uppercase tracking-widest">
                  {locale === 'bn' ? 'সক্রিয় সংযোগ' : 'Active Connection'}
                </span>
              )}
            </div>

            <div className="flex-1 min-h-0 relative">
              {activeTrip ? (
                <div 
                  ref={mapRef} 
                  className="absolute inset-0 w-full h-full rounded-xl border border-gray-100 shadow-inner" 
                  style={{ zIndex: 1 }} 
                />
              ) : (
                <div className="absolute inset-0 w-full h-full rounded-xl bg-gray-50/50 flex flex-col items-center justify-center border border-dashed border-gray-200 p-6 text-center space-y-2">
                  <div className="p-3 rounded-full bg-gray-100 text-gray-400">
                    <MapPin size={24} />
                  </div>
                  <div className="space-y-0.5 max-w-[240px]">
                    <p className="font-extrabold text-gray-700 text-xs">
                      {locale === 'bn' ? 'ম্যাপ নিষ্ক্রিয়' : 'Map Currently Idle'}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      {locale === 'bn' 
                        ? 'অ্যাম্বুলেন্স অনুরোধ করার পর এখানে লাইভ ট্র্যাকিং চালু হবে।'
                        : 'Once you trigger an emergency dispatch request, the interactive routing map will load here.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 bg-gray-50/80 border border-gray-100 rounded-xl p-2.5 text-[9px] text-gray-500 shrink-0 mt-3">
              <Info size={10} className="text-teal-600 shrink-0" />
              <p>
                {locale === 'bn'
                  ? 'উত্তম ফলাফলের জন্য ব্রাউজারের জিপিএস চালু রাখুন।'
                  : 'For best results, keep your mobile GPS enabled and allow precise location share prompts.'}
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Ambulance;
