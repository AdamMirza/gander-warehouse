'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp, runTransaction, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/context/AuthContext';

interface FirestorePart {
  id: string;
  partNumber: string;
  name: string;
  description: string;
  manufacturer: string;
  inventoryIds: string[];
  image?: string;
}

interface InventoryItem {
  id: string;
  partId: string;
  condition: string;
  count: number;
}

interface Part {
  id: string;
  partNumber: string;
  ataChapter: string;
  condition: string;
  quantity: number;
}

interface OrderItem {
  partNumber: string;
  ataChapter: string;
  condition: string;
  quantity: number;
  isCustomPart: boolean;
  partId?: string; // Only present for database parts
  inventoryId?: string; // Only present for database parts with specific inventory
}

interface Order {
  userId: string;
  userEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  orderNumber: string;
  items: OrderItem[];
  createdAt: any; // FirebaseFirestore.Timestamp
  updatedAt: any; // FirebaseFirestore.Timestamp
  notes?: string;
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
  const { user } = useAuth();
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
  const [availableConditions, setAvailableConditions] = useState<string[]>([]);
  const [selectedPartInventory, setSelectedPartInventory] = useState<InventoryItem[]>([]);
  const [isCustomPart, setIsCustomPart] = useState(false);
  const [reservedQuantities, setReservedQuantities] = useState<Record<string, number>>({});

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
        setIsCustomPart(false);
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
        const isCustom = results.length === 0 && debouncedSearch.trim() !== '';
        setIsCustomPart(isCustom);
        if (isCustom) {
          setShowDropdown(false);
        }
      } catch (error) {
        console.error('Error searching parts:', error);
      } finally {
        setIsSearching(false);
      }
    };

    searchParts();
  }, [debouncedSearch]);

  // Function to fetch inventory for a selected part
  const fetchInventoryForPart = async (part: FirestorePart) => {
    try {
      // Single query instead of multiple promises
      const inventorySnapshot = await getDocs(
        query(
          collection(db, 'inventory'),
          where('partId', '==', part.id)
        )
      );

      const inventoryItems: InventoryItem[] = inventorySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InventoryItem));

      setSelectedPartInventory(inventoryItems);
      
      // Update available conditions based on inventory
      const conditions = inventoryItems
        .filter(item => item.count > 0) // Only show conditions with available stock
        .map(item => item.condition);
      setAvailableConditions(conditions);

      // Reset condition if current selection is not available
      if (!conditions.includes(currentPart.condition)) {
        setCurrentPart(prev => ({
          ...prev,
          condition: conditions[0] || 'New' // Default to first available condition
        }));
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  // Update handleSelectPart to fetch inventory
  const handleSelectPart = async (part: FirestorePart) => {
    setCurrentPart(prev => ({
      ...prev,
      partNumber: part.partNumber,
    }));
    setIsCustomPart(false);
    await fetchInventoryForPart(part);
    setShowDropdown(false);
  };

  const handleAddPart = () => {
    if (!currentPart.partNumber || !currentPart.ataChapter) return;

    // Check if this part already exists with same condition and ATA chapter
    const existingPartIndex = parts.findIndex(part => 
      part.partNumber === currentPart.partNumber &&
      part.condition === currentPart.condition &&
      part.ataChapter === currentPart.ataChapter
    );

    if (existingPartIndex !== -1) {
      // Calculate new quantity
      const existingPart = parts[existingPartIndex];
      let maxQuantity = isCustomPart ? 9999 : 0;
      
      if (!isCustomPart) {
        const inventory = selectedPartInventory.find(inv => inv.condition === currentPart.condition);
        if (inventory) {
          const reservedCount = reservedQuantities[inventory.id] || 0;
          maxQuantity = Math.max(0, inventory.count - reservedCount);
        }
      }

      const newQuantity = Math.min(existingPart.quantity + currentPart.quantity, maxQuantity);

      // Update reserved quantities for non-custom parts
      if (!isCustomPart) {
        const partRef = searchResults.find(p => p.partNumber === currentPart.partNumber);
        if (partRef) {
          const inventory = selectedPartInventory.find(inv => inv.condition === currentPart.condition);
          if (inventory) {
            setReservedQuantities(prev => ({
              ...prev,
              [inventory.id]: (prev[inventory.id] || 0) + (newQuantity - existingPart.quantity)
            }));
          }
        }
      }

      // Update the parts array with new quantity
      setParts(prevParts => {
        const newParts = [...prevParts];
        newParts[existingPartIndex] = {
          ...existingPart,
          quantity: newQuantity
        };
        return newParts;
      });
    } else {
      // Add as new part (existing logic)
      if (!isCustomPart) {
        const partRef = searchResults.find(p => p.partNumber === currentPart.partNumber);
        if (partRef) {
          const inventory = selectedPartInventory.find(inv => inv.condition === currentPart.condition);
          if (inventory) {
            setReservedQuantities(prev => ({
              ...prev,
              [inventory.id]: (prev[inventory.id] || 0) + currentPart.quantity
            }));
          }
        }
      }

    setParts([
      ...parts,
      {
        ...currentPart,
        id: crypto.randomUUID(),
      },
    ]);
    }

    // Reset form
    setCurrentPart({
      partNumber: '',
      ataChapter: '',
      condition: 'New',
      quantity: 1,
    });
  };

  const handleRemovePart = (id: string) => {
    const partToRemove = parts.find(part => part.id === id);
    if (partToRemove) {
      const partRef = searchResults.find(p => p.partNumber === partToRemove.partNumber);
      if (partRef) {
        const inventory = selectedPartInventory.find(inv => inv.condition === partToRemove.condition);
        if (inventory) {
          setReservedQuantities(prev => ({
            ...prev,
            [inventory.id]: Math.max(0, (prev[inventory.id] || 0) - partToRemove.quantity)
          }));
        }
      }
    }
    setParts(parts.filter(part => part.id !== id));
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${year}${month}${day}-${random}`;
  };

  const handleSubmitOrder = async () => {
    if (!user) return;
    if (parts.length === 0) {
      alert('Please add at least one part to your order.');
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // First, verify inventory availability and get latest counts
        const inventoryUpdates = await Promise.all(
          parts.map(async (part) => {
            const partRef = searchResults.find(p => p.partNumber === part.partNumber);
            if (!partRef) return null; // Skip custom parts

            // Get the inventory document directly using the document reference
            const inventoryRef = doc(db, 'inventory', selectedPartInventory.find(
              inv => inv.condition === part.condition && inv.partId === partRef.id
            )?.id || '');

            const inventorySnap = await transaction.get(inventoryRef);
            if (!inventorySnap.exists()) return null;

            const currentCount = inventorySnap.data().count;
            
            if (currentCount < part.quantity) {
              throw new Error(`Insufficient inventory for part ${part.partNumber}`);
            }

            return {
              ref: inventoryRef,
              currentCount,
              requestedCount: part.quantity,
              partNumber: part.partNumber
            };
          })
        );

        // Create the order document
        const orderRef = doc(collection(db, 'open-orders'));
        const orderItems: OrderItem[] = parts.map((part) => {
          const orderItem: OrderItem = {
            partNumber: part.partNumber,
            ataChapter: part.ataChapter,
            condition: part.condition,
            quantity: part.quantity,
            isCustomPart: true
          };

          const partRef = searchResults.find(p => p.partNumber === part.partNumber);
          if (partRef) {
            orderItem.isCustomPart = false;
            orderItem.partId = partRef.id;
            
            // Find matching inventory
            const inventory = selectedPartInventory.find(
              inv => inv.condition === part.condition
            );
            if (inventory) {
              orderItem.inventoryId = inventory.id;
            }
          }

          return orderItem;
        });

        const order = {
          userId: user.uid,
          userEmail: user.email || '',
          status: 'pending',
          orderNumber: generateOrderNumber(),
          items: orderItems,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // Set the order document
        transaction.set(orderRef, order);

        // Update inventory counts
        inventoryUpdates.forEach(update => {
          if (update) {
            const newCount = update.currentCount - update.requestedCount;
            console.log(`Updating inventory for ${update.partNumber}: ${update.currentCount} -> ${newCount}`);
            transaction.update(update.ref, {
              count: newCount
            });
          }
        });
      });

      // Reset form after successful submission
      setParts([]);
      setCurrentPart({
        partNumber: '',
        ataChapter: '',
        condition: 'New',
        quantity: 1,
      });
      setReservedQuantities({});

      alert('Order submitted successfully!');

    } catch (error) {
      console.error('Error submitting order:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('There was an error submitting your order. Please try again.');
      }
    }
  };

  // Render the condition dropdown based on whether it's a custom part or not
  const renderConditionDropdown = () => {
    if (isCustomPart) {
      return (
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
      );
    }

    // Group inventory items by condition and sum their counts
    const groupedInventory = selectedPartInventory.reduce<Record<string, { count: number, ids: string[] }>>(
      (acc, item) => {
        if (!acc[item.condition]) {
          acc[item.condition] = { count: 0, ids: [] };
        }
        // Subtract reserved quantities from available count
        const reservedCount = reservedQuantities[item.id] || 0;
        acc[item.condition].count += Math.max(0, item.count - reservedCount);
        acc[item.condition].ids.push(item.id);
        return acc;
      },
      {}
    );

    return (
      <select
        value={currentPart.condition}
        onChange={(e) => setCurrentPart({ ...currentPart, condition: e.target.value })}
        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 appearance-none"
        disabled={availableConditions.length === 0}
      >
        {availableConditions.length > 0 ? (
          Object.entries(groupedInventory).map(([condition, data]) => (
            <option 
              key={condition} 
              value={condition}
              disabled={data.count === 0}
            >
              {condition} ({data.count} available)
            </option>
          ))
        ) : (
          <option value="">No conditions available</option>
        )}
      </select>
    );
  };

  // Render quantity input based on whether it's a custom part
  const renderQuantityInput = () => {
    let maxQuantity = isCustomPart ? 9999 : 0;
    
    if (!isCustomPart) {
      const inventory = selectedPartInventory.find(inv => inv.condition === currentPart.condition);
      if (inventory) {
        const reservedCount = reservedQuantities[inventory.id] || 0;
        maxQuantity = Math.max(0, inventory.count - reservedCount);
      }
    }

    return (
      <input
        type="number"
        min="1"
        max={maxQuantity}
        value={currentPart.quantity}
        onChange={(e) => {
          const value = e.target.value === '' ? 1 : parseInt(e.target.value);
          if (isNaN(value)) {
            setCurrentPart(prev => ({ ...prev, quantity: 1 }));
          } else if (value > maxQuantity) {
            setCurrentPart(prev => ({ ...prev, quantity: maxQuantity }));
          } else {
            setCurrentPart(prev => ({ ...prev, quantity: value }));
          }
        }}
        onBlur={(e) => {
          const value = parseInt(e.target.value);
          if (isNaN(value) || value < 1) {
            setCurrentPart(prev => ({ ...prev, quantity: 1 }));
          }
        }}
        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800"
      />
    );
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Part Number
                </label>
                {isCustomPart && (
                  <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
                    <svg 
                      className="w-4 h-4 mr-1" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    No matching parts found. You can still use this part number.
                  </span>
                )}
              </div>
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
              {showDropdown && (currentPart.partNumber || isSearching) && !isCustomPart && (
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
                              {part.manufacturer} • {selectedPartInventory.reduce((sum, inv) => sum + inv.count, 0)} available
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
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
                    {renderConditionDropdown()}
                    <SelectArrowIcon />
                  </div>
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Quantity
                  </label>
                  {renderQuantityInput()}
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Order Summary</h2>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to remove all parts from this order?')) {
                    setParts([]);
                  }
                }}
                className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                  />
                </svg>
                Clear All Parts
              </button>
            </div>
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