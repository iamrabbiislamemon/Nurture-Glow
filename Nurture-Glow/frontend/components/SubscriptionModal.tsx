"use client";

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Truck, Box, Sparkles, MapPin, Calendar, Trash2, AlertCircle } from 'lucide-react';

interface SubscriptionData {
  plan: string;
  price: number;
  currency: string;
  trimester: string;
  address: string;
  deliveryDay: string;
  status: string;
  createdAt: string;
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: SubscriptionData) => void;
  onCancelSubscription: () => void;
  existingData: SubscriptionData | null;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  onCancelSubscription,
  existingData 
}) => {
  const [trimester, setTrimester] = useState('2nd');
  const [address, setAddress] = useState('');
  const [deliveryDay, setDeliveryDay] = useState('Saturday');
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    if (existingData) {
      setTrimester(existingData.trimester);
      setAddress(existingData.address);
      setDeliveryDay(existingData.deliveryDay);
    } else {
      setTrimester('2nd');
      setAddress('');
      setDeliveryDay('Saturday');
    }
    setAddressError(null);
  }, [existingData, isOpen]);

  if (!isOpen) return null;

  const handleConfirmSubscription = () => {
    if (!address.trim()) {
      setAddressError("Delivery address is required.");
      return;
    }
    
    if (address.trim().length < 10) {
      setAddressError("Please enter a detailed address (at least 10 characters).");
      return;
    }

    setAddressError(null);

    const subscriptionPayload: SubscriptionData = {
      plan: "Maternal Subscription Box",
      price: 1500,
      currency: "BDT",
      trimester,
      address: address.trim(),
      deliveryDay,
      status: "ACTIVE",
      createdAt: existingData?.createdAt || new Date().toISOString()
    };

    onConfirm(subscriptionPayload);
  };

  return (
    <div 
      className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl space-y-8 animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[90vh] relative pointer-events-auto border border-amber-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-display">Maternal Subscription</h2>
            <p className="text-sm text-gray-400 font-medium font-sans">৳1,500 / month • Next delivery: Upcoming</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-50 rounded-full transition-colors cursor-pointer text-gray-400 hover:text-amber-700">
            <X size={24} />
          </button>
        </div>

        {/* Included Items */}
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-amber-100 p-6 rounded-[32px] space-y-4">
          <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={14} /> Included in your box
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "Trimester-specific vitamins",
              "Organic healthy snacks",
              "Stretch mark care oil",
              "Hydration reminder bottle",
              "Monthly baby milestone card",
              "Priority clinic support"
            ].map((benefit, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-gray-600 font-medium font-sans">
                <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" /> {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Trimester Select */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-2 font-sans">
              <Box size={12} /> Current Trimester
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['1st', '2nd', '3rd'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrimester(t)}
                  className={`py-3 rounded-2xl text-xs font-bold border-2 transition-all cursor-pointer font-sans ${
                    trimester === t 
                      ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-700/20' 
                      : 'bg-white border-amber-100 text-gray-500 hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  {t} Trimester
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-2 font-sans">
              <MapPin size={12} /> Delivery Address
            </label>
            <textarea
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (e.target.value.trim().length >= 10) setAddressError(null);
              }}
              placeholder="House #, Road #, Area, City..."
              className={`w-full h-24 p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl outline-none focus:ring-4 transition-all text-sm font-medium resize-none border-2 font-sans ${
                addressError ? 'border-red-300 focus:ring-red-100' : 'border-amber-100 focus:ring-amber-100 focus:border-amber-300'
              }`}
            />
            {addressError && (
              <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider ml-4 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={10} /> {addressError}
              </p>
            )}
          </div>

          {/* Delivery Day */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-2 font-sans">
              <Calendar size={12} /> Preferred Delivery Day
            </label>
            <select
              value={deliveryDay}
              onChange={(e) => setDeliveryDay(e.target.value)}
              className="w-full p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl outline-none focus:ring-4 focus:ring-amber-100 border-2 border-amber-100 focus:border-amber-300 transition-all text-sm font-bold cursor-pointer font-sans"
            >
              <option>Saturday</option>
              <option>Sunday</option>
              <option>Monday</option>
              <option>Wednesday</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="relative z-50 pointer-events-auto flex flex-col gap-3 pb-2">
          <button 
            type="button"
            onClick={handleConfirmSubscription}
            className="w-full py-5 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-3xl font-bold shadow-xl shadow-emerald-700/20 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer relative uppercase tracking-widest text-xs"
          >
            <Truck size={20} />
            <span>
              {existingData ? 'Update Subscription' : 'Confirm Subscription'}
            </span>
          </button>
          
          {existingData && (
            <button
              type="button"
              onClick={onCancelSubscription}
              className="relative z-50 mx-auto mt-4 flex items-center justify-center gap-2 text-[12px] font-extrabold tracking-[0.28em] text-red-500 hover:text-red-600 active:scale-[0.99] cursor-pointer transition-all p-2 rounded-xl hover:bg-red-50"
              style={{ pointerEvents: "auto" }}
            >
              <Trash2 size={16} />
              CANCEL SUBSCRIPTION
            </button>
          )}

          <p className="text-[10px] text-center text-gray-400 font-medium font-sans">
            You can modify or cancel your subscription at any time.
          </p>
        </div>
      </div>
    </div>
  );
};
