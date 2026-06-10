import React, { useEffect, useState, useRef } from 'react';
import { 
  Play, Square, MapPin, Phone, ShieldAlert, CheckCircle2, XCircle, 
  History, Navigation, ToggleLeft, ToggleRight, Loader2, AlertCircle
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Trip {
  id: string;
  patientId: string;
  driverId?: string;
  status: 'PENDING' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';
  patientLat: number;
  patientLng: number;
  destinationHospital: string;
  createdAt: string;
}

interface PatientDetails {
  name: string;
  phone: string;
  pregnancyWeek?: number;
  highRiskConditions?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  } | null;
}

interface HistoryTrip {
  id: string;
  status: string;
  patientLat: number;
  patientLng: number;
  destinationHospital: string;
  createdAt: string;
  patientName: string;
}

const DriverDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [isOnline, setIsOnline] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<HistoryTrip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Emergency Alert Overlay State
  const [pendingAlert, setPendingAlert] = useState<{
    trip: Trip;
    patient: PatientDetails;
  } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const mapLayersGroupRef = useRef<L.LayerGroup | null>(null);

  // 1. Fetch profile and active trip on mount
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        // Fetch driver profile
        const profileData = await apiFetch<{ driver: { vehicleNumber: string; isAvailable: boolean } }>(
          '/api/ambulance/profile'
        );
        setVehicleNumber(profileData.driver.vehicleNumber);
        setIsOnline(profileData.driver.isAvailable);

        // Fetch active trip
        const tripData = await apiFetch<{ trip: Trip | null; patientDetails: PatientDetails | null }>(
          '/api/ambulance/active-trip'
        );
        if (tripData.trip) {
          setActiveTrip(tripData.trip);
          setPatientDetails(tripData.patientDetails);
        }
      } catch (err) {
        console.error('Error fetching driver initial data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitData();
  }, []);

  // 2. Fetch history when history tab is open
  useEffect(() => {
    if (activeTab === 'history') {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
          const data = await apiFetch<{ items: HistoryTrip[] }>('/api/ambulance/history');
          setHistory(data.items || []);
        } catch (err) {
          console.error('Error fetching trip history:', err);
        } finally {
          setHistoryLoading(false);
        }
      };
      fetchHistory();
    }
  }, [activeTab]);

  // 3. Connect WebSocket if Online
  useEffect(() => {
    if (!isOnline) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('ng_auth_token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Match the server host dynamically
    const hostname = window.location.hostname || 'localhost';
    const port = '4000'; // backend port
    const wsUrl = `${protocol}//${hostname}:${port}/ws/ambulance?token=${token}`;

    console.log('[AmbulanceWS] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[AmbulanceWS] Message received:', data);

        if (data.type === 'emergency-alert') {
          // Loud popup for pending emergency request
          // Play a sound to alert the driver
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch (e) {}
          setPendingAlert({
            trip: data.trip,
            patient: data.patient
          });
        } else if (data.type === 'trip-cancelled') {
          // If the patient cancels, alert driver and clean up
          alert('The patient has cancelled this emergency trip request.');
          setActiveTrip(null);
          setPatientDetails(null);
          setPendingAlert(null);
        }
      } catch (err) {
        console.error('Error processing socket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[AmbulanceWS] Socket closed');
    };

    return () => {
      ws.close();
    };
  }, [isOnline]);

  // 4. Geolocation tracking & WS emitting (every 3 seconds)
  useEffect(() => {
    if (!isOnline || !socketRef.current || !activeTrip) return;

    // First coordinate update immediately
    const updateLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setDriverLocation({ lat, lng });

          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(
              JSON.stringify({
                type: 'location-update',
                tripId: activeTrip.id,
                lat,
                lng
              })
            );
          }
        },
        (err) => console.error('[DriverLocation] Error getting current position:', err),
        { enableHighAccuracy: true }
      );
    };

    updateLocation();
    const intervalId = setInterval(updateLocation, 3000);

    return () => clearInterval(intervalId);
  }, [isOnline, activeTrip]);

  // 5. Leaflet Map setup & updates
  useEffect(() => {
    if (!mapRef.current || activeTab !== 'overview') {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      return;
    }

    // Initialize Map if not present
    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapRef.current, {
        center: [23.8103, 90.4125],
        zoom: 13
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

    // Custom Icons
    const ambulanceIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/1048/1048329.png', // Red Ambulance icon
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const patientIcon = L.icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const hospitalIcon = L.icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const bounds: any[] = [];

    // 1. Add Driver marker
    if (driverLocation) {
      L.marker([driverLocation.lat, driverLocation.lng], { icon: ambulanceIcon })
        .bindPopup('Your Location (Ambulance)')
        .addTo(layerGroup);
      bounds.push([driverLocation.lat, driverLocation.lng]);
    }

    // 2. Add Patient and Hospital markers if active trip exists
    if (activeTrip) {
      L.marker([activeTrip.patientLat, activeTrip.patientLng], { icon: patientIcon })
        .bindPopup(`Patient: ${patientDetails?.name || 'Mother'}`)
        .addTo(layerGroup);
      bounds.push([activeTrip.patientLat, activeTrip.patientLng]);

      // Connect route (Polyline)
      if (driverLocation) {
        (L as any).polyline(
          [
            [driverLocation.lat, driverLocation.lng],
            [activeTrip.patientLat, activeTrip.patientLng]
          ],
          { color: '#ef4444', weight: 4, dashArray: '5, 10' }
        ).addTo(layerGroup);
      }

      // Hospital location query - mock coordinates relative to patient for routing
      // Hospital usually has catalog coordinates, but for simple routing we can place a mock marker 
      // representing the hospital destination 0.02 degrees North-East of the patient location 
      // if we don't have explicit hospital coordinates.
      const hospitalLat = activeTrip.patientLat + 0.015;
      const hospitalLng = activeTrip.patientLng + 0.015;
      L.marker([hospitalLat, hospitalLng], { icon: hospitalIcon })
        .bindPopup(`Destination: ${activeTrip.destinationHospital}`)
        .addTo(layerGroup);
      bounds.push([hospitalLat, hospitalLng]);

      (L as any).polyline(
        [
          [activeTrip.patientLat, activeTrip.patientLng],
          [hospitalLat, hospitalLng]
        ],
        { color: '#10b981', weight: 4 }
      ).addTo(layerGroup);
    }

    // Fit map bounds
    if (bounds.length > 0) {
      map.fitBounds(bounds as any, { padding: [50, 50] } as any);
    }
  }, [activeTab, activeTrip, driverLocation, patientDetails]);

  // --- Actions ---

  const handleToggleOnline = async () => {
    try {
      const nextState = !isOnline;
      await apiFetch('/api/ambulance/driver/toggle-availability', {
        method: 'POST',
        body: JSON.stringify({ isAvailable: nextState })
      });
      setIsOnline(nextState);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle availability.');
    }
  };

  const handleAcceptAlert = async () => {
    if (!pendingAlert) return;
    try {
      const data = await apiFetch<{ success: boolean; patientDetails: PatientDetails }>(
        '/api/ambulance/accept',
        {
          method: 'POST',
          body: JSON.stringify({ tripId: pendingAlert.trip.id })
        }
      );
      if (data.success) {
        setActiveTrip({
          ...pendingAlert.trip,
          status: 'EN_ROUTE'
        });
        setPatientDetails(pendingAlert.patient);
        setPendingAlert(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to accept trip.');
    }
  };

  const handleDeclineAlert = () => {
    setPendingAlert(null);
  };

  const handleArrive = async () => {
    if (!activeTrip) return;
    try {
      await apiFetch('/api/ambulance/arrive', {
        method: 'POST',
        body: JSON.stringify({ tripId: activeTrip.id })
      });
      setActiveTrip({
        ...activeTrip,
        status: 'ARRIVED'
      });
    } catch (err: any) {
      alert(err.message || 'Failed to mark arrival.');
    }
  };

  const handleComplete = async () => {
    if (!activeTrip) return;
    try {
      await apiFetch('/api/ambulance/complete', {
        method: 'POST',
        body: JSON.stringify({ tripId: activeTrip.id })
      });

      // DATA SECURITY ENFORCEMENT: Immediately clear patient medical snapshot from UI and memory!
      setActiveTrip(null);
      setPatientDetails(null);
      alert('Trip completed successfully! Patient details cleared from device.');
    } catch (err: any) {
      alert(err.message || 'Failed to complete trip.');
    }
  };

  const handleCancel = async () => {
    if (!activeTrip) return;
    if (!window.confirm('Are you sure you want to cancel this emergency dispatch trip?')) return;
    try {
      await apiFetch('/api/ambulance/cancel', {
        method: 'POST',
        body: JSON.stringify({ tripId: activeTrip.id })
      });

      // Clear details immediately
      setActiveTrip(null);
      setPatientDetails(null);
      alert('Trip cancelled. Patient details cleared from device.');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel trip.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={36} className="animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5EF] p-4 md:p-8">
      {/* Header Panel */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="text-red-500" /> Ambulance Driver Portal
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Vehicle: <span className="font-semibold text-gray-800">{vehicleNumber}</span> &middot; Active Driver ID: {user?.id.slice(0, 8)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-600">
              {isOnline ? 'ONLINE & AVAILABLE' : 'OFFLINE'}
            </span>
            <button
              onClick={handleToggleOnline}
              disabled={!!activeTrip}
              className={`p-1 rounded-full cursor-pointer transition-colors ${
                isOnline ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-400'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={activeTrip ? 'Cannot go offline during a trip' : ''}
            >
              {isOnline ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-red-500 text-white shadow-lg shadow-red-100'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Navigation size={16} className="inline mr-2" /> Live Overview
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-red-500 text-white shadow-lg shadow-red-100'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <History size={16} className="inline mr-2" /> Trip History
          </button>
        </div>

        {/* Live Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Map Frame */}
            <div className="lg:col-span-8 bg-white rounded-3xl p-4 shadow-sm border border-gray-200 space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-gray-900">Emergency Route Tracking</h3>
                {activeTrip && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                    Active Trip: {activeTrip.status}
                  </span>
                )}
              </div>
              <div 
                ref={mapRef} 
                className="h-[400px] w-full rounded-2xl overflow-hidden border border-gray-100" 
                style={{ zIndex: 1 }}
              />
            </div>

            {/* Side Control Board */}
            <div className="lg:col-span-4 space-y-6">
              {!isOnline ? (
                <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200 text-center space-y-3">
                  <AlertCircle className="text-amber-500 mx-auto" size={40} />
                  <h3 className="font-bold text-amber-800">You are Offline</h3>
                  <p className="text-xs text-amber-700">
                    Toggle your status to Online to receive dispatch alerts and update location.
                  </p>
                </div>
              ) : activeTrip ? (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-50 px-2 py-1 rounded">
                      Assigned Emergency
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mt-2">{patientDetails?.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Status: <span className="font-bold text-red-600">{activeTrip.status}</span></p>
                  </div>

                  {/* Privacy Guard Notice */}
                  <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full shrink-0 mt-1.5" />
                    <p className="text-[11px] text-teal-800 leading-relaxed font-semibold">
                      Privacy Guard: Patient medical history is restricted and hidden from this terminal.
                    </p>
                  </div>

                  {/* Destination Hospital */}
                  <div className="flex gap-3 text-sm">
                    <MapPin className="text-[#E6C77A] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-gray-800">Destination Hospital</p>
                      <p className="text-xs text-gray-600 mt-1">{activeTrip.destinationHospital}</p>
                    </div>
                  </div>

                  {/* In-app call interactions */}
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={`tel:${patientDetails?.phone}`}
                      className="flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all border border-red-200"
                    >
                      <Phone size={14} /> Call Mother
                    </a>
                    {patientDetails?.emergencyContact ? (
                      <a
                        href={`tel:${patientDetails.emergencyContact.phone}`}
                        className="flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-all border border-gray-200"
                        title={`Call ${patientDetails.emergencyContact.name} (${patientDetails.emergencyContact.relation})`}
                      >
                        <Phone size={14} /> Call Contact
                      </a>
                    ) : (
                      <button
                        disabled
                        className="flex items-center justify-center gap-2 p-3 bg-gray-50 text-gray-400 rounded-xl text-xs font-bold border border-gray-200 cursor-not-allowed opacity-50"
                      >
                        No Emergency Contact
                      </button>
                    )}
                  </div>

                  {/* Status update buttons */}
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    {activeTrip.status === 'EN_ROUTE' && (
                      <button
                        onClick={handleArrive}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-100 transition-all cursor-pointer"
                      >
                        <Play size={16} /> Mark Arrived
                      </button>
                    )}

                    {activeTrip.status === 'ARRIVED' && (
                      <button
                        onClick={handleComplete}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 transition-all cursor-pointer"
                      >
                        <CheckCircle2 size={16} /> Complete Trip
                      </button>
                    )}

                    <button
                      onClick={handleCancel}
                      className="w-full flex items-center justify-center gap-2 p-4 bg-white hover:bg-red-50 text-red-500 border-2 border-red-200 rounded-xl font-bold text-sm transition-all cursor-pointer"
                    >
                      <Square size={14} /> Cancel Trip
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Waiting for Dispatch</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      You are online. A loud alert overlay will appear when a nearby mother calls for transport.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Completed & Cancelled Trips</h3>
            
            {historyLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No past trips logged.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase tracking-widest">
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-4 font-bold">Patient Name</th>
                      <th className="py-3 px-4 font-bold">Hospital Destination</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((trip) => (
                      <tr key={trip.id} className="border-b border-gray-100 hover:bg-gray-50/50 text-sm">
                        <td className="py-4 px-4 text-gray-600 font-medium">
                          {new Date(trip.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </td>
                        <td className="py-4 px-4 text-gray-900 font-bold">{trip.patientName}</td>
                        <td className="py-4 px-4 text-gray-600">{trip.destinationHospital}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                            trip.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {trip.status === 'COMPLETED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {trip.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Emergency Alert Overlay Modal */}
      {pendingAlert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-8 border-4 border-red-500 shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
            <div className="flex items-center gap-4 text-red-600">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                <ShieldAlert size={36} />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-wider">Emergency Dispatch</h2>
                <p className="text-xs text-red-500 font-bold animate-pulse mt-0.5">HIGH PRIORITY ACTION REQUIRED</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border-t border-b border-gray-100 py-4 space-y-2 text-left">
                <p className="text-sm">Patient: <span className="font-extrabold text-gray-900">{pendingAlert.patient.name}</span></p>
                <p className="text-sm">Contact: <span className="font-bold text-gray-750">{pendingAlert.patient.phone}</span></p>
                <p className="text-sm mt-2">Destination: <span className="font-bold text-gray-700">{pendingAlert.trip.destinationHospital}</span></p>
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-150 text-[10px] text-teal-800 font-semibold leading-relaxed">
                  Privacy Guard: Gestational progress and medical reports are restricted.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleDeclineAlert}
                className="py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-all cursor-pointer"
              >
                Decline Request
              </button>
              <button
                onClick={handleAcceptAlert}
                className="py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl text-sm shadow-xl shadow-red-200 transition-all cursor-pointer"
              >
                Accept & Respond
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
