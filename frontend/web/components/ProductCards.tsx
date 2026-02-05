// ========== components/ProductCards.tsx ==========
'use client';

import { Product } from '@/types';

interface ProductCardsProps {
  products: Product[];
}

export default function ProductCards({ products }: ProductCardsProps) {
  if (!products || products.length === 0) return null;

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { class: 'text-red-500', text: '✗ Habis' };
    if (stock <= 5) return { class: 'text-yellow-500', text: `⚠ ${stock} unit` };
    return { class: 'text-green-500', text: '✓ Tersedia' };
  };

  return (
    <div className="max-w-full self-start animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-600">
          🛍️ {products.length} Produk Ditemukan
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {products.map((product) => {
          const stock = getStockStatus(product.stock);
          
          return (
            <div
              key={product.id}
              onClick={() => window.open(`https://dummy-ecommerce-tau.vercel.app/product/${product.id}`, '_blank')}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-black transition-all w-60 max-md:w-full"
            >
              {/* Image */}
              <img
                src={product.image_url || `https://picsum.photos/seed/${product.id}/300/300`}
                alt={product.name}
                className="w-full h-36 object-cover bg-gray-100"
                loading="lazy"
              />

              {/* Info */}
              <div className="p-2.5">
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded text-[0.65rem] text-gray-600 mb-1.5 font-medium">
                  {product.category || 'Produk'}
                </span>

                <div className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 min-h-[34px] leading-tight">
                  {product.name}
                </div>

                <div className="flex justify-between items-center mt-2">
                  <span className="text-[0.95rem] font-bold text-black">
                    Rp {product.price.toLocaleString('id-ID')}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs text-gray-500 font-medium">
                    ⭐ {product.rating || 0}
                  </span>
                </div>

                <div className={`text-[0.7rem] mt-1.5 font-medium ${stock.class}`}>
                  {stock.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}