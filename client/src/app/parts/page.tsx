'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, orderBy, getDocs, updateDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

interface OrderItem {
  partNumber: string;
  ataChapter: string;
  condition: string;
  quantity: number;
  isCustomPart: boolean;
  partId?: string;
  inventoryId?: string;
}

interface Order {
  id: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'processing' | 'approved' | 'closed';
  orderNumber: string;
  items: OrderItem[];
  createdAt: any;
  updatedAt: any;
  notes?: string;
  closureReason?: 'abandoned' | 'in shipment' | 'fulfilled';
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const closureReasonConfig = {
  abandoned: {
    color: 'text-red-600 dark:text-red-400',
    label: 'Abandoned by user'
  },
  'in shipment': {
    color: 'text-blue-600 dark:text-blue-400',
    label: 'In Shipment'
  },
  fulfilled: {
    color: 'text-green-600 dark:text-green-400',
    label: 'Fulfilled'
  }
} as const;

export default function PartsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [isClosedOrdersVisible, setIsClosedOrdersVisible] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isBulkAbandoning, setIsBulkAbandoning] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;

      try {
        const ordersRef = collection(db, 'open-orders');
        const q = query(
          ordersRef,
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const fetchedOrders = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Order));

        setOrders(fetchedOrders);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleAbandonOrder = async (orderId: string) => {
    if (!user) return;
    
    try {
      setUpdatingOrder(orderId);
      
      // Get the order we're abandoning
      const orderToAbandon = orders.find(order => order.id === orderId);
      if (!orderToAbandon) return;

      await runTransaction(db, async (transaction) => {
        // Get all non-custom parts that need inventory restoration
        const inventoryUpdates = orderToAbandon.items
          .filter(item => !item.isCustomPart && item.inventoryId)
          .map(async (item) => {
            const inventoryRef = doc(db, 'inventory', item.inventoryId!);
            const inventorySnap = await transaction.get(inventoryRef);
            
            if (!inventorySnap.exists()) return null;

            return {
              ref: inventoryRef,
              currentCount: inventorySnap.data().count,
              quantityToRestore: item.quantity
            };
          });

        const inventoryDocs = await Promise.all(inventoryUpdates);

        // Update the order status
        const orderRef = doc(db, 'open-orders', orderId);
        transaction.update(orderRef, {
          status: 'closed',
          closureReason: 'abandoned',
          updatedAt: new Date()
        });

        // Restore inventory counts
        inventoryDocs.forEach(doc => {
          if (doc) {
            transaction.update(doc.ref, {
              count: doc.currentCount + doc.quantityToRestore
            });
          }
        });
      });

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                status: 'closed' as const,
                closureReason: 'abandoned' as const,
                updatedAt: new Date() 
              }
            : order
        )
      );
    } catch (error) {
      console.error('Error abandoning order:', error);
      alert('There was an error abandoning the order. Please try again.');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleBulkAbandon = async () => {
    if (!user || selectedOrders.size === 0) return;
    
    try {
      setIsBulkAbandoning(true);
      
      for (const orderId of selectedOrders) {
        const orderToAbandon = orders.find(order => order.id === orderId);
        if (!orderToAbandon) continue;

        await runTransaction(db, async (transaction) => {
          // Get all non-custom parts that need inventory restoration
          const inventoryUpdates = orderToAbandon.items
            .filter(item => !item.isCustomPart && item.inventoryId)
            .map(async (item) => {
              const inventoryRef = doc(db, 'inventory', item.inventoryId!);
              const inventorySnap = await transaction.get(inventoryRef);
              
              if (!inventorySnap.exists()) return null;

              return {
                ref: inventoryRef,
                currentCount: inventorySnap.data().count,
                quantityToRestore: item.quantity
              };
            });

          const inventoryDocs = await Promise.all(inventoryUpdates);

          // Update the order status
          const orderRef = doc(db, 'open-orders', orderId);
          transaction.update(orderRef, {
            status: 'closed',
            closureReason: 'abandoned',
            updatedAt: new Date()
          });

          // Restore inventory counts
          inventoryDocs.forEach(doc => {
            if (doc) {
              transaction.update(doc.ref, {
                count: doc.currentCount + doc.quantityToRestore
              });
            }
          });
        });
      }

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          selectedOrders.has(order.id)
            ? { 
                ...order, 
                status: 'closed' as const,
                closureReason: 'abandoned' as const,
                updatedAt: new Date() 
              }
            : order
        )
      );

      setSelectedOrders(new Set());
    } catch (error) {
      console.error('Error abandoning orders:', error);
      alert('There was an error abandoning the orders. Please try again.');
    } finally {
      setIsBulkAbandoning(false);
    }
  };

  const getOrdersByStatus = (orders: Order[]) => {
    return orders.reduce<{ active: Order[]; closed: Order[] }>(
      (acc, order) => {
        if (order.status === 'closed') {
          acc.closed.push(order);
        } else {
          acc.active.push(order);
        }
        return acc;
      },
      { active: [], closed: [] }
    );
  };

  const renderOrderActions = (order: Order) => {
    if (order.status === 'processing') {
      return (
        <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 italic">
          This order is being processed and cannot be modified
        </div>
      );
    }

    if (order.status === 'pending' || order.status === 'approved') {
      return (
        <div className="mt-4 flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAbandonOrder(order.id);
            }}
            disabled={updatingOrder === order.id}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {updatingOrder === order.id ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Abandoning...
              </>
            ) : (
              'Abandon Order'
            )}
          </button>
        </div>
      );
    }

    return null;
  };

  const renderOrdersList = (orders: Order[], title: string) => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {selectedOrders.size > 0 && (
          <button
            onClick={handleBulkAbandon}
            disabled={isBulkAbandoning}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isBulkAbandoning ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Abandoning {selectedOrders.size} orders...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Abandon {selectedOrders.size} orders
              </>
            )}
          </button>
        )}
      </div>
      <div className="space-y-4 mb-8">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center gap-4">
                {(order.status === 'pending' || order.status === 'approved') && (
                  <div 
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={(e) => {
                        setSelectedOrders(prev => {
                          const newSet = new Set(prev);
                          if (e.target.checked) {
                            newSet.add(order.id);
                          } else {
                            newSet.delete(order.id);
                          }
                          return newSet;
                        });
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div 
                  className="flex-grow cursor-pointer"
                  onClick={() => toggleOrderExpansion(order.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <h2 className="text-xl font-semibold">{order.orderNumber}</h2>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      {order.status === 'closed' && order.closureReason && (
                        <span className={`text-sm font-medium ${closureReasonConfig[order.closureReason].color}`}>
                          {closureReasonConfig[order.closureReason].label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>

            {expandedOrders.has(order.id) && (
              <div className="border-t border-slate-200 dark:border-slate-700 p-6">
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg"
                    >
                      <div>
                        <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                          Part Number
                        </span>
                        <span className="text-slate-900 dark:text-white">
                          {item.partNumber}
                        </span>
                      </div>
                      <div>
                        <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                          ATA Chapter
                        </span>
                        <span className="text-slate-900 dark:text-white">
                          {item.ataChapter}
                        </span>
                      </div>
                      <div>
                        <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                          Condition
                        </span>
                        <span className="text-slate-900 dark:text-white">
                          {item.condition}
                        </span>
                      </div>
                      <div>
                        <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                          Quantity
                        </span>
                        <span className="text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {renderOrderActions(order)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );

  const renderClosedOrdersSection = (closedOrders: Order[]) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      <button
        onClick={() => setIsClosedOrdersVisible(!isClosedOrdersVisible)}
        className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <h2 className="text-2xl font-semibold">Closed Orders</h2>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="text-sm">{closedOrders.length} order{closedOrders.length !== 1 ? 's' : ''}</span>
          <svg
            className={`w-5 h-5 transform transition-transform ${isClosedOrdersVisible ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>
      {isClosedOrdersVisible && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          <div className="p-6">
            <div className="space-y-4">
              {closedOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden"
                >
                  <div 
                    className="p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => toggleOrderExpansion(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <h2 className="text-xl font-semibold">{order.orderNumber}</h2>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                        {order.status === 'closed' && order.closureReason && (
                          <span className={`text-sm font-medium ${closureReasonConfig[order.closureReason].color}`}>
                            {closureReasonConfig[order.closureReason].label}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {expandedOrders.has(order.id) && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-6">
                      <div className="space-y-4">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg"
                          >
                            <div>
                              <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                                Part Number
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {item.partNumber}
                              </span>
                            </div>
                            <div>
                              <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                                ATA Chapter
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {item.ataChapter}
                              </span>
                            </div>
                            <div>
                              <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                                Condition
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {item.condition}
                              </span>
                            </div>
                            <div>
                              <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                                Quantity
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {item.quantity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {renderOrderActions(order)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-6">
        <div className="container mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 px-6">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-6">Manage Orders</h1>

        <div>
          {(() => {
            const { active, closed } = getOrdersByStatus(orders);
            return (
              <>
                {active.length > 0 ? (
                  renderOrdersList(active, 'Active Orders')
                ) : (
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center mb-8">
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                      No open orders found. Start by creating a new order.
                    </p>
                    <Link
                      href="/parts/create"
                      className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Create New Order
                    </Link>
                  </div>
                )}
                {closed.length > 0 && renderClosedOrdersSection(closed)}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
} 