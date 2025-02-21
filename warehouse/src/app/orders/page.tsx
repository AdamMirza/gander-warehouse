'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import OrderStatusModal from '@/components/OrderStatusModal';

interface Part {
  id: string;
  name: string;
  description: string;
  manufacturer: string;
  location?: string;
  minQuantity?: number;
  currentQuantity?: number;
  partNumber: string;
  category?: string;
}

interface OrderItem {
  partNumber: string;
  quantity: number;
  part?: Part;
}

interface Order {
  id: string;
  status: string;
  customerName: string;
  orderDate: string;
  requestedBy: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [closedOrders, setClosedOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const ordersQuery = query(collection(db, 'open-orders'));

    const unsubscribe = onSnapshot(ordersQuery, 
      async (snapshot) => {
        try {
          const open: Order[] = [];
          const closed: Order[] = [];

          // Process all orders and fetch part details
          for (const doc of snapshot.docs) {
            const orderData = doc.data();
            const order = { id: doc.id, ...orderData } as Order;
            
            // Fetch part details for each item in the order
            const itemsWithParts = await Promise.all(order.items.map(async (item) => {
              // Query parts collection for matching part number
              const partsQuery = query(
                collection(db, 'parts'),
                where('partNumber', '==', item.partNumber)
              );
              
              const partSnapshot = await getDocs(partsQuery);
              
              if (!partSnapshot.empty) {
                const partDoc = partSnapshot.docs[0];
                return {
                  ...item,
                  part: { id: partDoc.id, ...partDoc.data() } as Part
                };
              }
              
              return item; // Return original item if part not found
            }));

            order.items = itemsWithParts;

            if (order.status === 'closed') {
              closed.push(order);
            } else {
              open.push(order);
            }
          }

          setOpenOrders(open);
          setClosedOrders(closed);
          setLoading(false);
        } catch (err) {
          console.error('Error processing orders:', err);
          setError('Error loading order details. Please try again.');
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching orders:', error);
        setError('Error loading orders. Please check your connection and permissions.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCloseOrder = async (orderId: string, status: string) => {
    try {
      const orderRef = doc(db, 'open-orders', orderId);
      await updateDoc(orderRef, {
        status: status,
        completedAt: new Date().toISOString()
      });
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error closing order:', error);
      alert('Failed to update order status. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-lg">Loading orders...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-700 dark:text-red-200">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Warehouse Orders</h1>
      
      {/* Open Orders Section */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Open Orders</h2>
        <div className="grid gap-4">
          {openOrders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-lg">{order.customerName}</h3>
                    {order.priority && (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        order.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        order.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {order.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-1">Ordered: {formatDate(order.orderDate)}</p>
                  <p className="text-sm text-gray-500 mb-1">Requested by: {order.requestedBy}</p>
                  {order.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">Note: {order.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Complete Order
                </button>
              </div>
              
              <div className="mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm border-b dark:border-gray-700">
                      <th className="pb-2">Part Details</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2">Quantity</th>
                      <th className="pb-2">Stock Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={index} className="border-b dark:border-gray-700 last:border-0">
                        <td className="py-3">
                          {item.part ? (
                            <>
                              <div className="font-medium">{item.part.name}</div>
                              <div className="text-sm text-gray-500">P/N: {item.partNumber}</div>
                              <div className="text-sm text-gray-500">{item.part.manufacturer}</div>
                            </>
                          ) : (
                            <div className="text-sm text-red-500">
                              Part not found: {item.partNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          {item.part?.location || 'No location set'}
                        </td>
                        <td className="py-3">
                          <span className="font-medium">{item.quantity}</span>
                        </td>
                        <td className="py-3">
                          {item.part && (
                            <div className={`text-sm ${
                              (item.part.currentQuantity || 0) < (item.part.minQuantity || 0) 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              Current: {item.part.currentQuantity || 0}
                              {item.part.minQuantity && ` (Min: ${item.part.minQuantity})`}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Closed Orders Section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Closed Orders</h2>
        <div className="grid gap-4">
          {closedOrders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-medium">{order.customerName}</h3>
                  <span className="text-sm text-gray-500">Completed</span>
                </div>
                <p className="text-sm text-gray-500">Ordered: {formatDate(order.orderDate)}</p>
                <p className="text-sm text-gray-500">Requested by: {order.requestedBy}</p>
              </div>
              <div className="mt-4">
                <table className="w-full">
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={index} className="border-b dark:border-gray-700 last:border-0">
                        <td className="py-2">
                          <div className="font-medium">{item.part?.name || 'Part not found'}</div>
                          <div className="text-sm text-gray-500">P/N: {item.partNumber}</div>
                        </td>
                        <td className="py-2 text-right">
                          Qty: {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add the modal */}
      {selectedOrder && (
        <OrderStatusModal
          isOpen={true}
          onClose={() => setSelectedOrder(null)}
          onConfirm={(status) => handleCloseOrder(selectedOrder.id, status)}
          orderItems={selectedOrder.items}
        />
      )}
    </div>
  );
} 