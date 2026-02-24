// components/ProductCards.tsx
"use client";

import { Product } from "@/types";
import Image from "next/image";
import Link from "next/link";

interface ProductCardsProps {
    products: Product[];
}

export default function ProductCards({ products }: ProductCardsProps) {
    if (!products || products.length === 0) return null;

    const uniqueProducts = Array.from(
        new Map(products.map((p) => [p.id, p])).values(),
    );

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(price);
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-3">
                <div className="flex items-center gap-2 text-md font-medium text-white">
                    🛍️ <span>{uniqueProducts.length} Produk Ditemukan</span>
                </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 gap-3">
                {uniqueProducts.map((product) => (
                    <Link
                        key={product.id}
                        href={`https://dummy-ecommerce-tau.vercel.app/product/${product.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block">
                        <div className="bg-black-50 border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer">
                            {/* Image */}
                            <div className="relative aspect-square bg-black-50 overflow-hidden">
                                {product.image_url ? (
                                    <Image
                                        src={product.image_url}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 50vw, 25vw"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <svg
                                            className="w-16 h-16"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={1}
                                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-3">
                                {/* Category Badge */}
                                {product.category && (
                                    <div className="mb-2">
                                        <span className="inline-block px-2 py-0.5 text-[0.65rem] font-medium text-gray-600 bg-gray-100 rounded-md">
                                            {product.category}
                                        </span>
                                    </div>
                                )}

                                {/* Product Name */}
                                <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2 leading-tight">
                                    {product.name}
                                </h3>

                                {/* Price */}
                                <div className="flex items-baseline gap-1.5 mb-2">
                                    <span className="text-base font-bold text-white">
                                        {formatPrice(product.price)}
                                    </span>
                                </div>

                                {/* Stock Status */}
                                {product.stock !== undefined && (
                                    <div className="flex items-center gap-1.5">
                                        {product.stock > 0 ? (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                <span className="text-[0.7rem] text-green-600 font-medium">
                                                    Tersedia
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                <span className="text-[0.7rem] text-red-600 font-medium">
                                                    Habis
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Footer hint */}
            <div className="mt-3 text-xs text-gray-400 italic">
                💬 Tanyakan detail produk atau minta tambahkan ke keranjang
            </div>
        </div>
    );
}
