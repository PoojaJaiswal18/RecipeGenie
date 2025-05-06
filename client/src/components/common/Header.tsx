import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authApi from '../../api/auth';
// Import icons individually from @react-icons/all-files
import { HiOutlineMenu } from '@react-icons/all-files/hi/HiOutlineMenu';
import { HiX } from '@react-icons/all-files/hi/HiX';
import { HiOutlineLogout } from '@react-icons/all-files/hi/HiOutlineLogout';
import { HiOutlineUser } from '@react-icons/all-files/hi/HiOutlineUser';
import { HiOutlineHeart } from '@react-icons/all-files/hi/HiOutlineHeart';

const Header: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const isLoggedIn = authApi.isAuthenticated();
  const user = authApi.getCurrentUser();

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  return (
    <header className="bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4V20M18 12L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M17 18C17 19.1046 14.7614 20 12 20C9.23858 20 7 19.1046 7 18" stroke="currentColor" strokeWidth="2"/>
              <path d="M17 6C17 7.10457 14.7614 8 12 8C9.23858 8 7 7.10457 7 6C7 4.89543 9.23858 4 12 4C14.7614 4 17 4.89543 17 6Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="text-white font-bold text-xl md:text-2xl tracking-tight">Recipe Genie</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-white hover:text-teal-100 font-medium">Home</Link>
            {isLoggedIn ? (
              <>
                <Link to="/favorites" className="text-white hover:text-teal-100 font-medium flex items-center">
                  <HiOutlineHeart className="mr-1" size={20} />
                  Favorites
                </Link>
                <Link to="/profile" className="text-white hover:text-teal-100 font-medium flex items-center">
                  <HiOutlineUser className="mr-1" size={20} />
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-white text-teal-600 hover:bg-teal-50 px-4 py-2 rounded-lg font-medium flex items-center"
                >
                  <HiOutlineLogout className="mr-1" size={20} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-white hover:text-teal-100 font-medium">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-white text-teal-600 hover:bg-teal-50 px-4 py-2 rounded-lg font-medium"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <HiX className="h-6 w-6" size={24} />
            ) : (
              <HiOutlineMenu className="h-6 w-6" size={24} />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <nav className="md:hidden mt-4 pb-4">
            <div className="flex flex-col space-y-3">
              <Link
                to="/"
                className="text-white hover:text-teal-100 font-medium"
                onClick={() => setIsOpen(false)}
              >
                Home
              </Link>
              {isLoggedIn ? (
                <>
                  <Link
                    to="/favorites"
                    className="text-white hover:text-teal-100 font-medium flex items-center"
                    onClick={() => setIsOpen(false)}
                  >
                    <HiOutlineHeart className="mr-1" size={20} />
                    Favorites
                  </Link>
                  <Link
                    to="/profile"
                    className="text-white hover:text-teal-100 font-medium flex items-center"
                    onClick={() => setIsOpen(false)}
                  >
                    <HiOutlineUser className="mr-1" size={20} />
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsOpen(false);
                    }}
                    className="bg-white text-teal-600 hover:bg-teal-50 px-4 py-2 rounded-lg font-medium flex items-center w-full"
                  >
                    <HiOutlineLogout className="mr-1" size={20} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-white hover:text-teal-100 font-medium"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-white text-teal-600 hover:bg-teal-50 px-4 py-2 rounded-lg font-medium text-center"
                    onClick={() => setIsOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;