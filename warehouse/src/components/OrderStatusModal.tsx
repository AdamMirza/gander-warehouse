'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface InventoryItem {
  partId: string;
  quantity: number;
}

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: string) => void;
  orderItems: Array<{
    partNumber: string;
    quantity: number;
    part?: {
      id: string;
      name: string;
      currentQuantity?: number;
    };
  }>;
}

export default function OrderStatusModal({ isOpen, onClose, onConfirm, orderItems }: OrderStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState('completed');
  const [inventoryCheck, setInventoryCheck] = useState<Array<{
    partNumber: string;
    partName: string;
    requested: number;
    available: number;
    hasEnough: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      checkInventory();
    }
  }, [isOpen, orderItems]);

  const checkInventory = async () => {
    setLoading(true);
    const inventoryResults = await Promise.all(
      orderItems.map(async (item) => {
        if (!item.part) {
          return {
            partNumber: item.partNumber,
            partName: 'Part not found',
            requested: item.quantity,
            available: 0,
            hasEnough: false
          };
        }

        // Get current inventory
        const inventoryQuery = query(
          collection(db, 'inventory'),
          where('partId', '==', item.part.id)
        );
        const inventorySnapshot = await getDocs(inventoryQuery);
        const totalInventory = inventorySnapshot.docs.reduce(
          (sum, doc) => sum + (doc.data().quantity || 0),
          0
        );

        return {
          partNumber: item.partNumber,
          partName: item.part.name,
          requested: item.quantity,
          available: totalInventory,
          hasEnough: totalInventory >= item.quantity
        };
      })
    );

    setInventoryCheck(inventoryResults);
    setLoading(false);
  };

  if (!isOpen) return null;

  const hasInsufficientInventory = inventoryCheck.some(item => !item.hasEnough);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Complete Order</h2>
        
        {loading ? (
          <div className="text-center py-4">Checking inventory...</div>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="font-medium mb-2">Inventory Check:</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="px-4 py-2 text-left">Part</th>
                      <th className="px-4 py-2 text-right">Requested</th>
                      <th className="px-4 py-2 text-right">Available</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryCheck.map((item, index) => (
                      <tr key={index} className="border-t dark:border-gray-600">
                        <td className="px-4 py-2">
                          <div>{item.partName}</div>
                          <div className="text-sm text-gray-500">P/N: {item.partNumber}</div>
                        </td>
                        <td className="px-4 py-2 text-right">{item.requested}</td>
                        <td className="px-4 py-2 text-right">{item.available}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.hasEnough 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {item.hasEnough ? 'Sufficient' : 'Insufficient'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <label className="block font-medium mb-2">
                Set Order Status:
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="completed">Completed</option>
                <option value="partial">Partially Completed</option>
                <option value="pending">Pending - Insufficient Stock</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {hasInsufficientInventory && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 text-yellow-700 dark:text-yellow-400">
                Warning: Some items have insufficient inventory. Consider marking as "Pending" or "Partial".
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(selectedStatus)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Confirm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 