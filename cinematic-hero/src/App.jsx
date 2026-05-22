import React, { useState } from 'react';
import { Search, User, Menu, X, Star, Clock, Calendar, Play, ChevronLeft, ChevronRight } from 'lucide-react';

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Helper for staggered animation class
  const blurFadeUpClass = "animate-blur-fade-up opacity-0";

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      {/* Background Video */}
      <video
        className="fixed inset-0 w-full h-full object-cover z-0"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Bottom Blur Overlay */}
      <div 
        className="fixed inset-0 z-[1] pointer-events-none backdrop-blur-xl"
        style={{
          maskImage: 'linear-gradient(to top, black 0%, transparent 45%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 45%)'
        }}
      />

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-6">
        {/* Left: Logo */}
        <div 
          className={`h-8 md:h-10 text-2xl font-bold tracking-widest flex items-center ${blurFadeUpClass}`}
          style={{ animationDelay: '0ms' }}
        >
          CINEMATIC
        </div>

        {/* Center: Desktop Nav Links */}
        <div className="hidden lg:flex items-center space-x-8">
          {['Movies', 'TV Series', "Editor's Pick", 'Interviews', 'User Reviews'].map((item, idx) => (
            <a 
              key={item} 
              href="#" 
              className={`text-sm hover:text-gray-300 transition-colors ${blurFadeUpClass}`}
              style={{ animationDelay: `${100 + idx * 50}ms` }}
            >
              {item}
            </a>
          ))}
        </div>

        {/* Right: Buttons */}
        <div className="flex items-center space-x-4">
          <button 
            className={`hidden sm:flex items-center space-x-2 rounded-full liquid-glass px-4 md:px-6 py-2 ${blurFadeUpClass}`}
            style={{ animationDelay: '350ms' }}
          >
            <Search size={18} />
            <span className="text-sm font-medium">Search</span>
          </button>
          
          <button 
            className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-full liquid-glass ${blurFadeUpClass}`}
            style={{ animationDelay: '400ms' }}
          >
            <User size={18} />
          </button>

          <button 
            className={`lg:hidden relative flex items-center justify-center w-10 h-10 rounded-full liquid-glass ${blurFadeUpClass}`}
            style={{ animationDelay: '350ms' }}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu 
              size={18} 
              className={`absolute transition-all duration-500 ease-out ${isMobileMenuOpen ? 'rotate-180 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100'}`} 
            />
            <X 
              size={18} 
              className={`absolute transition-all duration-500 ease-out ${isMobileMenuOpen ? 'rotate-0 opacity-100 scale-100' : '-rotate-180 opacity-0 scale-50'}`} 
            />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div 
        className={`absolute top-[72px] left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-b border-gray-800 shadow-2xl transition-all duration-500 ease-out lg:hidden
        ${isMobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}
      >
        <div className="px-4 py-6 space-y-2">
          {['Movies', 'TV Series', "Editor's Pick", 'Interviews', 'User Reviews'].map((item, idx) => (
            <a 
              key={item} 
              href="#" 
              className="block py-3 px-3 rounded-lg hover:bg-gray-800/50 text-base font-medium transition-colors"
              style={{ 
                transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-20px)',
                opacity: isMobileMenuOpen ? 1 : 0,
                transition: `all 500ms ease-out ${100 + idx * 50}ms`
              }}
            >
              {item}
            </a>
          ))}
          
          <div 
            className="sm:hidden pt-4 mt-4 border-t border-gray-800 flex flex-col space-y-4"
            style={{ 
              transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-20px)',
              opacity: isMobileMenuOpen ? 1 : 0,
              transition: `all 500ms ease-out 350ms`
            }}
          >
            <button className="flex items-center space-x-3 w-full px-3 py-3 rounded-lg liquid-glass">
              <Search size={18} />
              <span>Search</span>
            </button>
            <button className="flex items-center space-x-3 w-full px-3 py-3 rounded-lg liquid-glass">
              <User size={18} />
              <span>Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero Content */}
      <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-6 md:px-12 pb-8 md:pb-16 z-10 pointer-events-none">
        <div className="flex flex-col md:flex-row md:items-end gap-8 pointer-events-auto">
          
          {/* Left Side */}
          <div className="flex-1 flex flex-col">
            {/* Metadata Row */}
            <div 
              className={`flex flex-wrap items-center gap-3 sm:gap-6 mb-6 md:mb-8 text-xs sm:text-sm ${blurFadeUpClass}`}
              style={{ animationDelay: '300ms' }}
            >
              <div className="flex items-center space-x-2">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                <span className="font-medium">8.7/10 IMDB</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock size={16} />
                <span>132 min</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar size={16} />
                <span>April, 2025</span>
              </div>
            </div>

            {/* Title */}
            <h1 
              className={`text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-normal tracking-[-0.04em] mb-4 md:mb-6 ${blurFadeUpClass}`}
              style={{ animationDelay: '400ms' }}
            >
              Step Through.<br/>Work Smarter.
            </h1>

            {/* Description */}
            <p 
              className={`text-base sm:text-lg md:text-xl text-gray-400 mb-6 md:mb-12 max-w-2xl ${blurFadeUpClass}`}
              style={{ animationDelay: '500ms' }}
            >
              A voyage through forgotten realms, where past and future intertwine.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button 
                className={`flex items-center space-x-2 bg-white text-black rounded-full font-medium px-6 sm:px-8 py-2.5 sm:py-3 hover:bg-gray-200 transition-colors ${blurFadeUpClass}`}
                style={{ animationDelay: '600ms' }}
              >
                <Play className="w-[18px] h-[18px] fill-black" />
                <span>Watch Now</span>
              </button>
              
              <button 
                className={`rounded-full font-medium liquid-glass px-6 sm:px-8 py-2.5 sm:py-3 hover:bg-white/10 transition-colors ${blurFadeUpClass}`}
                style={{ animationDelay: '700ms' }}
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Right Side (Navigation Arrows) */}
          <div className="flex items-center justify-start md:justify-end gap-3 sm:gap-4 mt-6 md:mt-0">
            <button 
              className={`rounded-full liquid-glass px-4 sm:px-6 py-2.5 sm:py-3 hover:bg-white/10 transition-colors ${blurFadeUpClass}`}
              style={{ animationDelay: '800ms' }}
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              className={`rounded-full liquid-glass px-4 sm:px-6 py-2.5 sm:py-3 hover:bg-white/10 transition-colors ${blurFadeUpClass}`}
              style={{ animationDelay: '900ms' }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default App;
