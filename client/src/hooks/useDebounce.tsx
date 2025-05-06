import { useState, useEffect } from 'react';

/**
 * A custom hook that delays updating a value until a specified delay has passed.
 * Useful for reducing API calls when user is typing.
 * 
 * @param value The value to debounce
 * @param delay The delay time in milliseconds (default: 500ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set debouncedValue to value after the specified delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // If the value changes, cancel the previous timer
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;