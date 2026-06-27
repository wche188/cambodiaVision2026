'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProvinces, getDistricts } from '@/data/cambodiaLocations';
import Image from 'next/image';
import toast, { Toaster } from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import BilingualLabel from '@/app/components/BilingualLabel';
import { t } from '@/lib/translations';

export default function RegistrationForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    patient_number: '',
    gender: 'Male',
    pregnant: 'No',
    blood_group: '',
    family_name: '',
    given_name: '',
    age: '',
    has_tb: false,
    contact_phone: '',
    province: '',
    district: '',
    village: '',
    commune: '',
    reason_for_visit: '',
    photo: null,
    registration_date: new Date().toISOString().split('T')[0]
  });
  
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [availableDistricts, setAvailableDistricts] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState(null);
  const [patientNumberError, setPatientNumberError] = useState('');
  const [checkingPatientNumber, setCheckingPatientNumber] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Validate Patient Number Format (0000-6000)
  const validatePatientNumberFormat = (value) => {
    if (!value) {
      return 'Patient number is required';
    }
    
    if (value.length !== 4) {
      return 'Patient number must be exactly 4 digits';
    }
    
    if (!/^\d{4}$/.test(value)) {
      return 'Patient number must contain only digits';
    }
    
    const numValue = parseInt(value, 10);
    if (numValue < 0 || numValue > 6000) {
      return 'Patient number must be between 0000 and 6000';
    }
    
    return null;
  };

  // Check if Patient Number exists in database
  const checkPatientNumberExists = async (patientNumber) => {
    try {
      const response = await fetch(`/api/patients?patient_number=${patientNumber}`);
      const { data, error } = await response.json();

      if (error) {
        console.error('Error checking patient number:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking patient number:', error);
      return false;
    }
  };

  // Handle Patient Number Change
  const handlePatientNumberChange = async (e) => {
    const value = e.target.value;
    
    // Only allow digits and limit to 4 characters
    if (value.length > 4 || (value && !/^\d*$/.test(value))) {
      return;
    }
    
    setFormData(prev => ({ ...prev, patient_number: value }));
    setPatientNumberError('');
    
    // Validate when 4 digits are entered
    if (value.length === 4) {
      const formatError = validatePatientNumberFormat(value);
      
      if (formatError) {
        setPatientNumberError(formatError);
        return;
      }
      
      // Check database
      setCheckingPatientNumber(true);
      const exists = await checkPatientNumberExists(value);
      setCheckingPatientNumber(false);
      
      if (exists) {
        setPatientNumberError(`Patient number ${value} is already registered. Please use a different number.`);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'province') {
      const districts = getDistricts(value);
      setAvailableDistricts(districts);
      setFormData(prev => ({
        ...prev,
        province: value,
        district: '',
        village: '',
        commune: '',
        reason_for_visit: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const startCamera = async () => {
    try {
      // Check if mediaDevices API is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera not available. On LAN, open chrome://flags and enable "Insecure origins treated as secure" with your server URL, then restart Chrome.');
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(mediaStream);
      setShowCamera(true);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (error) {
      toast.error('Unable to access camera. Please check permissions.');
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      canvas.toBlob(async (blob) => {
        await compressAndSetImage(blob);
      }, 'image/jpeg', 0.9);
      
      stopCamera();
    }
  };

  const compressAndSetImage = async (blob) => {
    try {
      toast.loading('Compressing image...', { id: 'compress' });

      const options = {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 531,
        useWebWorker: true,
        fileType: 'image/jpeg'
      };

      const compressedFile = await imageCompression(blob, options);

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setFormData(prev => ({ ...prev, photo: base64String }));
        setPhotoPreview(base64String);
        toast.success('Photo captured successfully!', { id: 'compress' });
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Error processing image', { id: 'compress' });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    await compressAndSetImage(file);
  };

  const removePhoto = () => {
    setFormData(prev => ({ ...prev, photo: null }));
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.success('Photo removed');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate Patient Number
    if (!formData.patient_number) {
      toast.error('Please enter Patient Number');
      return;
    }
    
    const formatError = validatePatientNumberFormat(formData.patient_number);
    if (formatError) {
      toast.error(formatError);
      setPatientNumberError(formatError);
      return;
    }
    
    if (patientNumberError) {
      toast.error('Please fix patient number errors before submitting');
      return;
    }
    
    // Final check for duplicate
    setCheckingPatientNumber(true);
    const exists = await checkPatientNumberExists(formData.patient_number);
    setCheckingPatientNumber(false);
    
    if (exists) {
      const errorMsg = `Patient number ${formData.patient_number} is already registered. Please use a different number.`;
      setPatientNumberError(errorMsg);
      toast.error(errorMsg);
      return;
    }
    
    // Validate other fields
    if (!formData.family_name.trim()) {
      toast.error('Please enter Family Name');
      return;
    }
    
    if (!formData.age || formData.age < 0) {
      toast.error('Please enter a valid age');
      return;
    }

    if (!formData.contact_phone.trim()) {
      toast.error('Please enter Contact Phone Number');
      return;
    }

    if (!formData.province) {
      toast.error('Please select a Province');
      return;
    }

    if (!formData.district) {
      toast.error('Please select a District');
      return;
    }

    if (!formData.reason_for_visit.trim()) {
      toast.error('Please enter Reason for visit');
      return;
    }

    try {
      setSubmitting(true);
      const loadingToast = toast.loading('Registering patient...');

      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_number: formData.patient_number,
          gender: formData.gender,
          is_pregnant: formData.pregnant,
          blood_group: formData.blood_group,
          family_name: formData.family_name,
          given_name: formData.given_name,
          age: parseInt(formData.age),
          has_tb: formData.has_tb,
          contact_phone: formData.contact_phone,
          province: formData.province,
          district: formData.district,
          village: formData.village || null,
          commune: formData.commune || null,
          reason_for_visit: formData.reason_for_visit,
          photo: formData.photo,
          registration_date: formData.registration_date
        }),
      });

      const { data, error } = await response.json();

      if (error) {
        // Handle duplicate key constraint error
        if (response.status === 409 || error.includes('already registered')) {
          const duplicateMsg = `Patient number ${formData.patient_number} is already registered. Please use a different number.`;
          setPatientNumberError(duplicateMsg);
          toast.error(duplicateMsg, { id: loadingToast });
          return;
        }
        throw new Error(error);
      }

      if (data) {
        setRegisteredPatient(data);
        
        toast.dismiss(loadingToast);
        setShowSuccess(true);
        
        // Reset form after 4 seconds
        setTimeout(() => {
          setShowSuccess(false);
          setFormData({
            patient_number: '',
            gender: 'Male',
            pregnant: 'No',
            blood_group: '',
            family_name: '',
            given_name: '',
            age: '',
            has_tb: false,
            contact_phone: '',
            province: '',
            district: '',
            village: '',
            commune: '',
            reason_for_visit: '',
            photo: null,
            registration_date: new Date().toISOString().split('T')[0]
          });
          setPhotoPreview(null);
          setRegisteredPatient(null);
          setAvailableDistricts([]);
          setPatientNumberError('');
        }, 4000);
      }
    } catch (error) {
      console.error('Error submitting form:', error);

      // Check for duplicate key error
      if (error.message?.includes('already registered') || error.message?.includes('Duplicate')) {
        const duplicateMsg = `Patient number ${formData.patient_number} is already registered. Please use a different number.`;
        setPatientNumberError(duplicateMsg);
        toast.error(duplicateMsg);
      } else {
        toast.error('Error registering patient: ' + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const provinces = getProvinces();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* Success Modal */}
      {showSuccess && registeredPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-scaleIn">
            <div className="mb-6">
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-bounceIn">
                <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Registration Successful!
            </h2>
            <p className="text-gray-600 mb-2">Patient has been registered successfully</p>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-6 mt-6 shadow-inner">
              <p className="text-sm text-gray-600 mb-2 font-medium">Patient Number</p>
              <p className="text-4xl font-bold text-blue-600 tracking-wide">
                #{String(registeredPatient.patient_number).padStart(4, '0')}
              </p>
            </div>
            <p className="text-sm text-gray-500 mt-6 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Please save this number for future reference
            </p>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Take Photo
              </h3>
              <button
                onClick={stopCamera}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
              />
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={capturePhoto}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Capture Photo
              </button>
              <button
                onClick={stopCamera}
                className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 relative flex-shrink-0">
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
                {t('nav.registration').en} <span className="font-khmer text-gray-500">| {t('nav.registration').km}</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return to Dashboard
          </Link>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 sm:px-8 py-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Patient Registration Form</h2>
            <p className="text-blue-100 mt-1 text-sm sm:text-base">Please fill in all required information</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Patient Number Input */}
            <div>
              <label className="block mb-2">
                <BilingualLabel labelKey="form.patient_number" /> <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="patient_number"
                  value={formData.patient_number}
                  onChange={handlePatientNumberChange}
                  maxLength={4}
                  className={`w-full md:w-1/2 px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all text-gray-700 ${
                    patientNumberError 
                      ? 'border-red-500 focus:ring-red-500' 
                      : formData.patient_number.length === 4 && !patientNumberError
                      ? 'border-green-500 focus:ring-green-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter 4-digit number (0000-6000)"
                  required
                />
                {checkingPatientNumber && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 md:right-[calc(50%+12px)]">
                    <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                {formData.patient_number.length === 4 && !patientNumberError && !checkingPatientNumber && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 md:right-[calc(50%+12px)]">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              {patientNumberError ? (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {patientNumberError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1.5">
                  Enter a unique 4-digit number between 0000 and 6000
                </p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block mb-2">
                <BilingualLabel labelKey="form.gender" /> <span className="text-red-500">*</span>
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-500"
                required
              >
                <option value="Male">Male | ប្រុស</option>
                <option value="Female">Female | ស្រី</option>
                <option value="Child">Child | ក្មេង</option>
              </select>

              {formData.gender === 'Female' && (
                <div className="mt-4">
                  <label className="block mb-2">
                    <BilingualLabel labelKey="form.is_pregnant" /> <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="pregnant"
                    value={formData.pregnant || ''}
                    onChange={handleChange}
                    className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-gray-500"
                    required
                  >
                    <option value="No">No / ទេ</option>
                    <option value="Yes">Yes / បាទ ឬ ចាស</option>
                  </select>
                </div>
              )}
            </div>

            {/* Full Name & Age */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block mb-2">
                  <BilingualLabel labelKey="form.family_name" /> <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="family_name"
                  value={formData.family_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-500"
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div>
                <label className="block mb-2">
                  <BilingualLabel labelKey="form.age" /> <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-500"
                  placeholder="Enter age"
                  required
                />
              </div>
            </div>
            <div>
                <label className="block mb-2">
                  <BilingualLabel labelKey="form.given_name" />
                </label>
                <input
                  type="text"
                  name="given_name"
                  value={formData.given_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-500"
                  placeholder="Enter Given name"
                />
              </div>

            {/* TB Status */}
            <div>
              <label className="block mb-2">
                <BilingualLabel labelKey="form.has_tb" /> <span className="text-red-500">*</span>
              </label>
              <select
                name="has_tb"
                value={formData.has_tb}
                onChange={handleChange}
                className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-500"
              >
                <option value={false}>No</option>
                <option value={true}>Yes</option>
              </select>
            </div>

            {/* Blood Group */}
            <div>
              <label className="block mb-2">
                <BilingualLabel labelKey="form.blood_group" />
              </label>
              <select
                name="blood_group"
                value={formData.blood_group}
                onChange={handleChange}
                className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-500"
              >
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block mb-2">
                <BilingualLabel labelKey="form.phone" /> <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-500"
                placeholder="e.g., 0887327589"
                required
              />
            </div>

            {/* Address Section */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-bold text-gray-800 mb-4">Present Address / From</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block mb-2">
                    <BilingualLabel labelKey="form.province" /> <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="province"
                    value={formData.province}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-500"
                    required
                  >
                    <option value="">-- Select Province --</option>
                    {provinces.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-2">
                    <BilingualLabel labelKey="form.district" /> <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-500"
                    required
                    disabled={!formData.province}
                  >
                    <option value="">
                      {!formData.province ? '-- Select Province First --' : '-- Select District --'}
                    </option>
                    {availableDistricts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block mb-2">
                    <BilingualLabel labelKey="form.village" />
                  </label>
                  <input
                    type="text"
                    name="village"
                    value={formData.village}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-500"
                    placeholder="Enter village name (optional)"
                    disabled={!formData.district}
                  />
                  {!formData.district && (
                    <p className="text-xs text-amber-600 mt-1.5">⚠ Please select district first</p>
                  )}
                </div>
                <div>
                  <label className="block mb-2">
                    <BilingualLabel labelKey="form.commune" />
                  </label>
                  <input
                    type="text"
                    name="commune"
                    value={formData.commune}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-500"
                    placeholder="Enter commune name (optional)"
                    disabled={!formData.district}
                  />
                  {!formData.district && (
                    <p className="text-xs text-amber-600 mt-1.5">⚠ Please select district first</p>
                  )}
                </div>
              </div>
            </div>

            {/* Reason for Visit - Pick and Select */}
            <div>
              <label className="block mb-2">
                <BilingualLabel labelKey="form.reason_for_visit" /> <span className="text-red-500">*</span>
              </label>
              <ReasonForVisitPicker
                value={formData.reason_for_visit}
                onChange={(val) => setFormData(prev => ({ ...prev, reason_for_visit: val }))}
                disabled={!formData.district}
              />
              {!formData.district && (
                <p className="text-xs text-amber-600 mt-1.5">⚠ Please select district first</p>
              )}
            </div>

            {/* Date */}
            {/* <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Registration Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="registration_date"
                value={formData.registration_date}
                readOnly
                className="w-full md:w-1/2 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1.5">Date is automatically set to today</p>
            </div> */}

            {/* Photo Upload Section */}
            <div className="border-t pt-6">
              <label className="block mb-3">
                <BilingualLabel labelKey="form.photo" />
              </label>
              
              {!photoPreview ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take Photo
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload from Device
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex items-start gap-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="relative">
                    <img 
                      src={photoPreview} 
                      alt="Patient" 
                      className="w-32 h-40 object-cover border-2 border-gray-300 rounded-lg shadow-md"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm text-green-700 font-semibold">Photo uploaded successfully</p>
                    </div>
                    <p className="text-xs text-gray-600">Photo has been compressed and optimized for storage</p>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium underline"
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-3 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Passport size photo recommended (will be compressed automatically to save storage space)</span>
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t flex justify-center">
              <button
                type="submit"
                disabled={submitting || checkingPatientNumber || !!patientNumberError}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  <span>{t('button.submit').en} <span className="font-khmer">/ {t('button.submit').km}</span></span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm">&copy; 2026 Cambodia Vision. All rights reserved.</p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }

        .animate-bounceIn {
          animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Reason for Visit — Pick and Select Component
// ============================================================
const VISIT_REASONS = {
  'Eye Conditions': {
    km: 'បញ្ហាភ្នែក',
    options: [
      { en: 'Blurry vision', km: 'មើលមិនច្បាស់' },
      { en: 'Cataract', km: 'បែកសរសៃភ្នែក' },
      { en: 'Pterygium', km: 'សាច់ដុះភ្នែក' },
      { en: 'Eye pain', km: 'ឈឺភ្នែក' },
      { en: 'Red eye', km: 'ភ្នែកក្រហម' },
      { en: 'Watery eyes', km: 'ទឹកភ្នែកហូរ' },
      { en: 'Itchy eyes', km: 'រមាស់ភ្នែក' },
      { en: 'Double vision', km: 'មើលឃើញពីរ' },
      { en: 'Trachoma', km: 'ជំងឺត្រាកូម៉ា' },
      { en: 'Glaucoma', km: 'ជំងឺសម្ពាធភ្នែក' },
    ],
  },
  'Vision Problems': {
    km: 'បញ្ហាចក្ខុវិស័យ',
    options: [
      { en: 'Cannot see far', km: 'មើលឆ្ងាយមិនឃើញ' },
      { en: 'Cannot see near', km: 'មើលជិតមិនឃើញ' },
      { en: 'Cannot see at night', km: 'មើលមិនឃើញពេលយប់' },
      { en: 'Need glasses', km: 'ត្រូវការវ៉ែនតា' },
      { en: 'Glasses update', km: 'ធ្វើបច្ចុប្បន្នភាពវ៉ែនតា' },
      { en: 'Lost vision one eye', km: 'បាត់បង់ចក្ខុវិស័យម្ខាង' },
      { en: 'Lost vision both eyes', km: 'បាត់បង់ចក្ខុវិស័យទាំងពីរ' },
    ],
  },
  'General / Other': {
    km: 'ទូទៅ / ផ្សេងៗ',
    options: [
      { en: 'Follow-up visit', km: 'មកពិនិត្យតាមដាន' },
      { en: 'Post-surgery check', km: 'ពិនិត្យក្រោយវះកាត់' },
      { en: 'Injury / Trauma', km: 'របួស / របូស' },
      { en: 'Screening', km: 'ពិនិត្យស្រង់' },
      { en: 'Referred by doctor', km: 'បញ្ជូនពីគ្រូពេទ្យ' },
    ],
  },
};

function ReasonForVisitPicker({ value, onChange, disabled }) {
  const [selected, setSelected] = useState(() => {
    // Parse existing value back into selections
    if (!value) return [];
    return value.split(', ').filter(Boolean);
  });
  const [customText, setCustomText] = useState('');

  const toggleOption = (optionText) => {
    let newSelected;
    if (selected.includes(optionText)) {
      newSelected = selected.filter(s => s !== optionText);
    } else {
      newSelected = [...selected, optionText];
    }
    setSelected(newSelected);
    onChange(buildOutput(newSelected, customText));
  };

  const handleCustomChange = (e) => {
    const text = e.target.value;
    setCustomText(text);
    onChange(buildOutput(selected, text));
  };

  const buildOutput = (selections, custom) => {
    const parts = [...selections];
    if (custom && custom.trim()) {
      parts.push(custom.trim());
    }
    return parts.join(', ');
  };

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {Object.entries(VISIT_REASONS).map(([sectionTitle, section]) => (
        <div key={sectionTitle}>
          <p className="text-sm font-semibold text-gray-700 mb-2">
            {sectionTitle} <span className="text-xs text-gray-400 font-normal">{section.km}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {section.options.map((option) => {
              const isActive = selected.includes(option.en);
              return (
                <button
                  key={option.en}
                  type="button"
                  onClick={() => toggleOption(option.en)}
                  className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium border transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <span>{option.en}</span>
                  <span className="block text-xs opacity-75">{option.km}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Additional notes */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Additional notes <span className="text-xs text-gray-400 font-normal">កំណត់ត្រាបន្ថែម</span>
        </p>
        <input
          type="text"
          value={customText}
          onChange={handleCustomChange}
          placeholder="Type any other details here..."
          className="w-full px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
        />
      </div>

      {/* Preview of combined value */}
      {(selected.length > 0 || customText) && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Selected reasons:</p>
          <p className="text-sm text-gray-900">{buildOutput(selected, customText)}</p>
        </div>
      )}
    </div>
  );
}