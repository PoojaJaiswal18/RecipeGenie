import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
}

/**
 * A custom hook that detects the device type and orientation.
 * 
 * @returns DeviceInfo object containing device type and orientation information
 */
export function useDeviceDetect(): DeviceInfo {
  // Initialize with defaults (to handle SSR)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    orientation: 'landscape'
  });

  useEffect(() => {
    // Function to determine device type based on screen width
    const determineDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Device detection
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const isDesktop = width >= 1024;
      
      // Orientation detection
      const orientation = width > height ? 'landscape' : 'portrait';
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        orientation
      });
    };

    // Initial detection
    determineDevice();

    // Listen for window resize events
    window.addEventListener('resize', determineDevice);
    
    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('resize', determineDevice);
    };
  }, []);

  return deviceInfo;
}

export default useDeviceDetect;