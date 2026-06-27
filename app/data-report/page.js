'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BilingualLabel from '@/app/components/BilingualLabel';
import { t } from '@/lib/translations';

const CACHE_KEY = 'cambodia_vision_report_data';
const CACHE_TIMESTAMP_KEY = 'cambodia_vision_report_timestamp';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export default function DataReport() {
  const [loading, setLoading] = useState(true);
  const [selectedDateOffset, setSelectedDateOffset] = useState(0); // 0 = today, -1 = yesterday, 1 = tomorrow
  const [dailyData, setDailyData] = useState({
    anaesthesiaToday: 0,
    surgeryToday: 0,
    date: new Date()
  });
  const [reportData, setReportData] = useState({
    totalRegistrations: 0,
    maleCount: 0,
    femaleCount: 0,
    childCount: 0,
    anaesthesiaCount: 0,
    surgeryCount: 0,
    lastUpdated: null,
    usingCache: false
  });

  // Fetch report data on mount
  useEffect(() => {
    fetchReportData();
  }, []);

  // Fetch daily data when date offset changes
  useEffect(() => {
    fetchDailyData();
  }, [selectedDateOffset]);

  const getCachedData = () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      
      if (cachedData && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const now = Date.now();
        
        // Check if cache is still valid (less than 1 hour old)
        if (now - timestamp < CACHE_DURATION) {
          return {
            data: JSON.parse(cachedData),
            timestamp: timestamp
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  };

  const setCachedData = (data) => {
    try {
      const timestamp = Date.now();
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toString());
      return timestamp;
    } catch (error) {
      console.error('Error setting cache:', error);
      return Date.now();
    }
  };

  const getDateForOffset = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date;
  };

  const getStartAndEndOfDay = (date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchDailyData = async () => {
    try {
      const response = await fetch(`/api/patients/report?dateOffset=${selectedDateOffset}`);
      const { data, error } = await response.json();

      if (error) throw new Error(error);

      setDailyData({
        anaesthesiaToday: data?.anaesthesiaToday || 0,
        surgeryToday: data?.surgeryToday || 0,
        date: getDateForOffset(selectedDateOffset)
      });

    } catch (error) {
      console.error('Error fetching daily data:', error);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);

    // Try to get cached data first
    const cached = getCachedData();

    if (cached) {
      setReportData({
        ...cached.data,
        lastUpdated: new Date(cached.timestamp),
        usingCache: true
      });
      setLoading(false);
      return;
    }

    // Fetch fresh data from database
    try {
      const response = await fetch('/api/patients/report');
      const { data, error } = await response.json();

      if (error) throw new Error(error);

      const newData = {
        totalRegistrations: data.totalRegistrations,
        maleCount: data.maleCount,
        femaleCount: data.femaleCount,
        childCount: data.childCount,
        anaesthesiaCount: data.anaesthesiaCount,
        surgeryCount: data.surgeryCount
      };

      // Cache the data
      const timestamp = setCachedData(newData);

      setReportData({
        ...newData,
        lastUpdated: new Date(timestamp),
        usingCache: false
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
      alert('Error loading report data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    // Clear cache and fetch fresh data
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    await fetchReportData();
    await fetchDailyData();
  };

  const getTimeUntilNextUpdate = () => {
    if (!reportData.lastUpdated) return null;
    
    const nextUpdate = new Date(reportData.lastUpdated.getTime() + CACHE_DURATION);
    const now = new Date();
    const diff = nextUpdate - now;
    
    if (diff <= 0) return 'Available now';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Less than a minute';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  };

  const getDateLabel = () => {
    if (selectedDateOffset === 0) return 'Today';
    if (selectedDateOffset === -1) return 'Yesterday';
    if (selectedDateOffset === 1) return 'Tomorrow';
    if (selectedDateOffset < -1) return `${Math.abs(selectedDateOffset)} days ago`;
    return `In ${selectedDateOffset} days`;
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 relative">
                <Image 
                  src="/logo.jpeg"
                  alt="Cambodia Vision Logo" 
                  width={80}
                  height={80}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">CAMBODIA VISION 2026</h1>
                <p className="text-sm sm:text-base text-gray-600">
                  {t('nav.data_report').en} <span className="font-khmer text-gray-500">| {t('nav.data_report').km}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return to Dashboard
          </Link>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {t('nav.data_report').en} <span className="font-khmer text-2xl text-gray-600">| {t('nav.data_report').km}</span>
          </h2>
          <p className="text-gray-600">Overview of patient registrations and treatments</p>
        </div>

        {/* Cache Info and Refresh Button */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${reportData.usingCache ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`}></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {reportData.usingCache ? 'Showing Cached Data' : 'Fresh Data Loaded'}
              </p>
              {reportData.lastUpdated && (
                <p className="text-xs text-gray-600">
                  Last updated: {reportData.lastUpdated.toLocaleString()} 
                  {reportData.usingCache && ` • Next update in: ${getTimeUntilNextUpdate()}`}
                </p>
              )}
            </div>
          </div>
          
          <button
            onClick={refreshData}
            disabled={loading}
            className="px-5 py-3 min-h-[44px] bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Now
          </button>
        </div>

        {loading && !reportData.lastUpdated ? (
          <div className="text-center py-12">
            <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">Loading report data...</p>
          </div>
        ) : (
          <>
            {/* Daily Treatments Card with Date Navigation */}
            <div className="mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-4">
                  {t('ui.daily_treatments').en} <span className="font-khmer text-lg text-white/80">| {t('ui.daily_treatments').km}</span>
                </h3>
                
                {/* Date Navigation - Mobile Optimized */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-4">
                  {/* Date Display - Above on Mobile */}
                  <div className="text-center order-1 md:order-2">
                    <p className="text-lg font-bold">{getDateLabel()}</p>
                    <p className="text-sm text-white/80">{formatDate(dailyData.date)}</p>
                  </div>
                  
                  {/* Navigation Buttons - Below on Mobile */}
                  <div className="flex items-center justify-center gap-3 order-2 md:order-1">
                    <button
                      onClick={() => setSelectedDateOffset(selectedDateOffset - 1)}
                      className="p-3 min-w-[44px] min-h-[44px] bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center justify-center"
                      title="Previous day"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSelectedDateOffset(selectedDateOffset + 1)}
                      className="p-3 min-w-[44px] min-h-[44px] bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center justify-center"
                      title="Next day"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Anaesthesia Today */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-white/80">Anaesthesia Given</p>
                      <p className="text-4xl font-bold">{dailyData.anaesthesiaToday}</p>
                    </div>
                  </div>
                  <p className="text-sm text-white/70">Patients received anaesthesia</p>
                </div>

                {/* Surgery Today */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-white/80">Surgeries Performed</p>
                      <p className="text-4xl font-bold">{dailyData.surgeryToday}</p>
                    </div>
                  </div>
                  <p className="text-sm text-white/70">Surgical procedures completed</p>
                </div>
              </div>

              {selectedDateOffset === 0 && (
                <div className="mt-4 text-center">
                  <span className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-sm">
                    <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="8" />
                    </svg>
                    Live data for today
                  </span>
                </div>
              )}
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Total Registrations */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm font-medium mb-1">
                  {t('ui.total_registrations').en}
                  <span className="block text-xs text-gray-400 font-khmer">{t('ui.total_registrations').km}</span>
                </h3>
                <p className="text-4xl font-bold text-gray-900">{reportData.totalRegistrations}</p>
              </div>

              {/* Male Count */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-400 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm font-medium mb-1">
                  {t('ui.male_patients').en}
                  <span className="block text-xs text-gray-400 font-khmer">{t('ui.male_patients').km}</span>
                </h3>
                <p className="text-4xl font-bold text-gray-900">{reportData.maleCount}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {reportData.totalRegistrations > 0 
                    ? `${((reportData.maleCount / reportData.totalRegistrations) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </p>
              </div>

              {/* Female Count */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-pink-400 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm font-medium mb-1">
                  {t('ui.female_patients').en}
                  <span className="block text-xs text-gray-400 font-khmer">{t('ui.female_patients').km}</span>
                </h3>
                <p className="text-4xl font-bold text-gray-900">{reportData.femaleCount}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {reportData.totalRegistrations > 0 
                    ? `${((reportData.femaleCount / reportData.totalRegistrations) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </p>
              </div>

              {/* Child Count */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-400 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm font-medium mb-1">
                  {t('ui.child_patients').en}
                  <span className="block text-xs text-gray-400 font-khmer">{t('ui.child_patients').km}</span>
                </h3>
                <p className="text-4xl font-bold text-gray-900">{reportData.childCount}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {reportData.totalRegistrations > 0 
                    ? `${((reportData.childCount / reportData.totalRegistrations) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </p>
              </div>

              {/* Anaesthesia Count */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm font-medium mb-1">
                  {t('ui.anaesthesia_treatments').en}
                  <span className="block text-xs text-gray-400 font-khmer">{t('ui.anaesthesia_treatments').km}</span>
                </h3>
                <p className="text-4xl font-bold text-gray-900">{reportData.anaesthesiaCount}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {reportData.totalRegistrations > 0 
                    ? `${((reportData.anaesthesiaCount / reportData.totalRegistrations) * 100).toFixed(1)}% of patients`
                    : '0%'
                  }
                </p>
              </div>

              {/* Surgery Count */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-gray-600 text-sm font-medium mb-1">
                  {t('ui.surgery_treatments').en}
                  <span className="block text-xs text-gray-400 font-khmer">{t('ui.surgery_treatments').km}</span>
                </h3>
                <p className="text-4xl font-bold text-gray-900">{reportData.surgeryCount}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {reportData.totalRegistrations > 0 
                    ? `${((reportData.surgeryCount / reportData.totalRegistrations) * 100).toFixed(1)}% of patients`
                    : '0%'
                  }
                </p>
              </div>
            </div>

            {/* Summary Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {t('ui.summary').en} <span className="font-khmer text-base text-gray-500">| {t('ui.summary').km}</span>
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Total Patients Registered:</span>
                  <span className="font-bold text-gray-900">{reportData.totalRegistrations}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Gender Distribution:</span>
                  <span className="font-medium text-gray-900">
                    {reportData.maleCount} Male, {reportData.femaleCount} Female, {reportData.childCount} Children
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Total Treatments Given:</span>
                  <span className="font-bold text-gray-900">
                    {reportData.anaesthesiaCount + reportData.surgeryCount}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Treatment Breakdown:</span>
                  <span className="font-medium text-gray-900">
                    {reportData.anaesthesiaCount} Anaesthesia, {reportData.surgeryCount} Surgery
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm">&copy; 2026 Cambodia Vision. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}