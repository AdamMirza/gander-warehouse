'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDebounce } from '@/hooks/useDebounce';

interface FirestorePart {
  id: string;
  partNumber: string;
  name: string;
  description: string;
  manufacturer: string;
  condition: string;
  quantityAvailable: number;
  image?: string;
}

interface Part {
  id: string;
  partNumber: string;
  ataChapter: string;
  condition: string;
  quantity: number;
}

const CONDITIONS = [
  'New',
  'Serviceable',
  'Overhauled',
  'As Removed',
  'Repairable',
] as const;

const ATA_CHAPTERS = [
  { code: '21', name: 'Air Conditioning' },
  { code: '22', name: 'Auto Flight' },
  { code: '23', name: 'Communications' },
  { code: '24', name: 'Electrical Power' },
  { code: '25', name: 'Equipment/Furnishings' },
  { code: '26', name: 'Fire Protection' },
  { code: '27', name: 'Flight Controls' },
  { code: '28', name: 'Fuel' },
  { code: '29', name: 'Hydraulic Power' },
  { code: '30', name: 'Ice & Rain Protection' },
  { code: '31', name: 'Instruments' },
  { code: '32', name: 'Landing Gear' },
  { code: '33', name: 'Lights' },
  { code: '34', name: 'Navigation' },
  { code: '35', name: 'Oxygen' },
  { code: '36', name: 'Pneumatic' },
] as const;

const SelectArrowIcon = () => (
  <svg
    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-slate-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M8 9l4 4 4-4"
    />
  </svg>
);

export default function CreateOrderPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [currentPart, setCurrentPart] = useState<Omit<Part, 'id'>>({
    partNumber: '',
    ataChapter: '',
    condition: 'New',
    quantity: 1,
  });
  
  const [searchResults, setSearchResults] = useState<FirestorePart[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(currentPart.partNumber, 300);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search parts in Firestore
  useEffect(() => {
    const searchParts = async () => {
      if (!debouncedSearch.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const partsRef = collection(db, 'parts');
        const q = query(
          partsRef,
          where('partNumber', '>=', debouncedSearch.toUpperCase()),
          where('partNumber', '<=', debouncedSearch.toUpperCase() + '\uf8ff'),
          limit(5)
        );

        const querySnapshot = await getDocs(q);
        const results = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FirestorePart));

        setSearchResults(results);
      } catch (error) {
        console.error('Error searching parts:', error);
      } finally {
        setIsSearching(false);
      }
    };

    searchParts();
  }, [debouncedSearch]);

  const handleSelectPart = (part: FirestorePart) => {
    setCurrentPart(prev => ({
      ...prev,
      partNumber: part.partNumber,
    }));
    setShowDropdown(false);
  };

  const handleAddPart = () => {
    if (!currentPart.partNumber || !currentPart.ataChapter) return;

    setParts([
      ...parts,
      {
        ...currentPart,
        id: crypto.randomUUID(),
      },
    ]);

    // Reset form
    setCurrentPart({
      partNumber: '',
      ataChapter: '',
      condition: 'New',
      quantity: 1,
    });
  };

  const handleRemovePart = (id: string) => {
    setParts(parts.filter(part => part.id !== id));
  };

  const handleSubmitOrder = () => {
    // TODO: Implement order submission
    console.log('Submitting order with parts:', parts);
  };

  return (
    <div className="min-h-screen pt-24 px-6">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Create New Order</h1>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Add Parts to Order</h2>
          <div className="space-y-4">
            {/* Part Number Search */}
            <div ref={searchRef} className="relative">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Part Number
              </label>
              <input
                type="text"
                value={currentPart.partNumber}
                onChange={(e) => {
                  setCurrentPart({ ...currentPart, partNumber: e.target.value });
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800"
                placeholder="Search or enter part number"
              />
              
              {/* Search Results Dropdown */}
              {showDropdown && (currentPart.partNumber || isSearching) && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                      Searching...
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((part) => (
                      <button
                        key={part.id}
                        onClick={() => handleSelectPart(part)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b last:border-b-0 border-slate-100 dark:border-slate-700"
                      >
                        <div className="flex items-start">
                          {part.image && (
                            <img
                              src={part.image}
                              alt={part.name}
                              className="w-12 h-12 object-cover rounded mr-3"
                            />
                          )}
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                              {part.partNumber}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {part.name}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">
                              {part.manufacturer} • {part.quantityAvailable} available
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : currentPart.partNumber ? (
                    <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                      No matching parts found. You can still use this part number.
                    </div>
                  ) : (
                    <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                      Start typing to search for parts
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ATA Chapter and Condition Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ATA Chapter
                </label>
                <div className="relative">
                  <select
                    value={currentPart.ataChapter}
                    onChange={(e) => setCurrentPart({ ...currentPart, ataChapter: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 appearance-none"
                  >
                    <option value="">Select ATA Chapter</option>
                    {ATA_CHAPTERS.map((chapter) => (
                      <option key={chapter.code} value={chapter.code}>
                        {chapter.code} - {chapter.name}
                      </option>
                    ))}
                  </select>
                  <SelectArrowIcon />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Condition
                  </label>
                  <div className="relative">
                    <select
                      value={currentPart.condition}
                      onChange={(e) => setCurrentPart({ ...currentPart, condition: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 appearance-none"
                    >
                      {CONDITIONS.map((condition) => (
                        <option key={condition} value={condition}>
                          {condition}
                        </option>
                      ))}
                    </select>
                    <SelectArrowIcon />
                  </div>
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={currentPart.quantity}
                    onChange={(e) => setCurrentPart({ ...currentPart, quantity: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleAddPart}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Part
            </button>
          </div>
        </div>

        {/* Parts List */}
        {parts.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            <div className="space-y-4">
              {parts.map((part) => (
                <div
                  key={part.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div>
                      <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                        Part Number
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        {part.partNumber}
                      </span>
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                        ATA Chapter
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        {part.ataChapter}
                      </span>
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                        Condition
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        {part.condition}
                      </span>
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                        Quantity
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        {part.quantity}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePart(part.id)}
                    className="ml-4 p-2 text-red-500 hover:text-red-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={handleSubmitOrder}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Submit Order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 