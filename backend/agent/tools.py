import logging
import time
import requests
from livekit.agents.llm import function_tool
<<<<<<< HEAD:agent/tools.py
=======
from langchain_community.tools import DuckDuckGoSearchRun
from agent.state import agent_state

>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py

# Base URL untuk e-commerce website
BASE_URL = "https://dummy-ecommerce-tau.vercel.app"

# Global state untuk auth (termasuk voice verification)
auth_state = {
    # Login state
    "token": None,
    "user_id": None,
    "username": None,
    "is_logged_in": False,
    # Voice verification state
    "voice_score": 0.0,
<<<<<<< HEAD:agent/tools.py
    "voice_status": "NOT_VERIFIED",  # NOT_VERIFIED, VERIFYING, VERIFIED, DENIED
    "last_verified_at": None,
=======
    "voice_status_detail": "INIT",
    "verify_attempts": 0,
 
    "voice_feedback_sent": False,
    "force_verify": False,
    "_force_started": False,
    "pending_action": None,
    "pending_params": None,
>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
}

def get_headers():
    """Get headers with auth token if logged in"""
    headers = {"Content-Type": "application/json"}
    if auth_state["token"]:
        headers["Authorization"] = f"Bearer {auth_state['token']}"
    return headers

<<<<<<< HEAD:agent/tools.py
=======

def is_voice_verified() -> bool:
    """
    Check if voice is currently verified.
    Returns False if never verified or if verification has expired.
    """
    if not agent_state["is_voice_verified"]:
        return False
    
    # Check if verification has expired
    now = time.time()
    if (now - agent_state["last_verified_at"]) > REVERIFY_INTERVAL:
        agent_state["is_voice_verified"] = False
        agent_state["voice_status"] = "EXPIRED"
        return False
    
    return True


def require_voice_verification(action_name: str, params=None) -> str:
    """
    Check voice verification status.
    Returns error message if not verified, None if verified.
    """
    if not is_voice_verified():
        auth_state["force_verify"] = True
        auth_state["pending_action"] = action_name
        auth_state["pending_params"] = params or {}
        return (
            f"⚠️ Gue gak bisa {action_name} sekarang karena suara lo belum diverifikasi. "
            "Coba ngomong lagi supaya gue bisa memastikan ini beneran lo."
        )
    return None


>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
# ==================== GENERAL TOOLS ====================

@function_tool
async def get_weather(city: str) -> str:
    """Get current weather for a given city."""
    try:
        response = requests.get(f"https://wttr.in/{city}?format=3", timeout=10)
        if response.status_code == 200:
            logging.info(f"Weather for {city}: {response.text.strip()}")
            return response.text.strip()
        else:
            logging.error(f"Failed to get weather for {city}: {response.status_code}")
            return f"Could not retrieve weather for {city}."
    except Exception as e:
        logging.error(f"Error retrieving weather for {city}: {e}")
        return f"Weather service error for {city}."

@function_tool
async def web_search(query: str) -> str:
    """Search the internet for information."""
    try:
        from langchain_community.tools import DuckDuckGoSearchRun
        return DuckDuckGoSearchRun().run(query)
    except Exception as e:
        logging.error(e)
        return "Search error."

# ==================== AUTH TOOLS ====================

@function_tool
async def login(username: str, password: str) -> str:
    """Login to the e-commerce website."""
    global auth_state
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/token",
            json={"username": username, "password": password},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        logging.info(f"Login response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                auth_state["token"] = data.get("token")
                auth_state["user_id"] = data.get("user", {}).get("id")
                auth_state["username"] = data.get("user", {}).get("username")
                auth_state["is_logged_in"] = True
                return f"Login berhasil! Selamat datang {auth_state['username']}."
        
        return "Login gagal. Username atau password salah."
            
    except Exception as e:
        logging.error(f"Login error: {e}")
        return f"Login error: {str(e)}"

@function_tool
async def register(username: str, password: str) -> str:
    """Register a new account on the e-commerce website."""
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"username": username, "password": password},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            return f"Registrasi berhasil! Silakan login dengan username: {username}"
        else:
            return "Registrasi gagal. Username mungkin sudah dipakai."
            
    except Exception as e:
        logging.error(f"Register error: {e}")
        return f"Registration error: {str(e)}"

@function_tool
async def logout() -> str:
    """Logout from the e-commerce website."""
    global auth_state
    auth_state = {
        "token": None,
        "user_id": None,
        "username": None,
        "is_logged_in": False,
        "is_voice_verified": False,
        "voice_score": 0.0,
        "voice_status": "NOT_VERIFIED",
        "last_verified_at": None,
    }
    return "Berhasil logout."

@function_tool
async def check_login_status() -> str:
    """Check if user is currently logged in."""
    if auth_state["is_logged_in"]:
        return f"Lo udah login sebagai {auth_state['username']}."
    return "Lo belum login. Login dulu ya buat belanja."

@function_tool
async def check_voice_status() -> str:
    """Check current voice verification status."""
<<<<<<< HEAD:agent/tools.py
    status = auth_state["voice_status"]
    score = auth_state["voice_score"]
    last_verified = auth_state["last_verified_at"]
    
    if status == "VERIFIED":
        time_ago = ""
        if last_verified:
            elapsed = time.time() - last_verified
            if elapsed < 60:
                time_ago = f" ({int(elapsed)} detik lalu)"
            elif elapsed < 3600:
                time_ago = f" ({int(elapsed/60)} menit lalu)"
            else:
                time_ago = f" ({int(elapsed/3600)} jam lalu)"
        return f"✅ Suara lo udah terverifikasi{time_ago}. Score: {score:.2f}"
    elif status == "VERIFYING":
        return "🔄 Lagi proses verifikasi suara... Coba ngomong lagi."
=======
    status = agent_state["voice_status"]
    
    if is_voice_verified():
        elapsed = int(time.time() - agent_state["last_verified_at"])
        remaining = REVERIFY_INTERVAL - elapsed
        return f"✅ Suara lo udah terverifikasi. Verifikasi aktif {remaining} detik lagi."
    elif status == "EXPIRED":
        return "⚠️ Verifikasi suara lo udah expired. Coba ngomong lagi buat verifikasi ulang."
>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
    elif status == "DENIED":
        return "❌ Verifikasi suara gagal. Suara lo gak cocok dengan data yang terdaftar."
    else:
        return "⚠️ Suara lo belum diverifikasi. Terus ngobrol aja, sistem akan otomatis verifikasi."

# ==================== USER TOOLS ====================

@function_tool
async def get_shopkupay_balance() -> str:
    """Get user's ShopKuPay balance/saldo."""
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu buat cek saldo ShopKuPay."
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/user",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            user = data.get("data", {})
            balance = user.get("balance", 0)
            return f"Saldo ShopKuPay lo: Rp {balance:,}"
        
        return "Gagal mengambil data saldo."
            
    except Exception as e:
        logging.error(f"Get balance error: {e}")
        return f"Error: {str(e)}"

# ==================== PRODUCT TOOLS ====================

@function_tool
async def search_product(
    query: str = "",
    category: str = "",
    min_price: int = 0,
    max_price: int = 0,
    min_rating: float = 0,
    sort: str = ""
) -> str:
    """
    Search for products with advanced filters.
    
    Args:
<<<<<<< HEAD:agent/tools.py
        query: Search keyword for product name
        category: Filter by category. Options: "Gadget & Tech", "Lifestyle", "Home & Living", "Lain-lain"
        min_price: Minimum price filter (e.g., 100000 for Rp 100.000)
        max_price: Maximum price filter (e.g., 5000000 for Rp 5.000.000)
        min_rating: Minimum rating filter (e.g., 4.0 or 4.5)
        sort: Sort order. Options: "price_asc" (cheapest first), "price_desc" (expensive first), "rating_desc" (highest rating)
    """
    try:
        params = {}
=======
        query: Search keyword for product name (optional - leave empty to get all products)
        category: Filter by category (Electronics, Fashion, Home, Sports, Books)
        min_price: Minimum price filter
        max_price: Maximum price filter  
        min_rating: Minimum rating filter (0.0-5.0)
        sort_by: Sort results (price_asc, price_desc, rating_desc, newest)
    """
    try:
        params = {}
        
>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
        if query:
            params["q"] = query
        if category:
            params["category"] = category
        if min_price > 0:
            params["min"] = str(min_price)
        if max_price > 0:
            params["max"] = str(max_price)
        if min_rating > 0:
            params["rating"] = str(min_rating)
        if sort:
            params["sort"] = sort
        
        response = requests.get(
            f"{BASE_URL}/api/products",
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            products = data.get("data", [])
            
            if not products:
                filter_desc = []
                if query:
                    filter_desc.append(f"keyword '{query}'")
                if category:
                    filter_desc.append(f"kategori '{category}'")
                if min_price > 0:
                    filter_desc.append(f"harga min Rp {min_price:,}")
                if max_price > 0:
                    filter_desc.append(f"harga max Rp {max_price:,}")
                if min_rating > 0:
                    filter_desc.append(f"rating {min_rating}+")
                
                filter_str = ", ".join(filter_desc) if filter_desc else "tanpa filter"
                return f"Gak nemu produk dengan {filter_str}."
            
            result = f"Ketemu {len(products)} produk:\n\n"
            for p in products[:10]:
                result += f"• ID: {p['id']} | {p['name']}\n"
                result += f"  Harga: Rp {p['price']:,} | Rating: {p['rating']}⭐ | {p['category']}\n\n"
            
            if len(products) > 10:
                result += f"... dan {len(products) - 10} produk lainnya."
            
            return result
        return "Gagal mencari produk."
            
    except Exception as e:
        logging.error(f"Search product error: {e}")
        return f"Search error: {str(e)}"

@function_tool
async def get_product_detail(product_id: int) -> str:
    """
    Get detailed information about a specific product.
    Returns: name, price, category, rating, stock, description, image URL, and product link.
    """
    try:
        response = requests.get(f"{BASE_URL}/api/products/{product_id}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            p = data.get("data", {})
            
            if not p:
                return f"Produk ID {product_id} gak ditemukan."
            
<<<<<<< HEAD:agent/tools.py
            return f"""Detail Produk:
• Nama: {p['name']}
• Harga: Rp {p['price']:,}
• Kategori: {p['category']}
• Rating: {p['rating']}⭐
• Stok: {p.get('stock', 'N/A')}
• Deskripsi: {p.get('description', '-')}"""
=======
            # Get all product info
            name = p.get('name', 'Unknown')
            price = p.get('price', 0)
            category = p.get('category', '-')
            rating = p.get('rating', 0)
            stock = p.get('stock', 0)
            description = p.get('description', 'Tidak ada deskripsi')
            image_url = p.get('image_url', f"https://picsum.photos/seed/{product_id}/300/300")
            
            # Generate product link
            product_link = f"{BASE_URL}/product/{product_id}"
            
            # Stock status
            if stock > 10:
                stock_status = f"✅ Tersedia ({stock} unit)"
            elif stock > 0:
                stock_status = f"⚠️ Stok terbatas ({stock} unit)"
            else:
                stock_status = "❌ Habis"
            
            return f"""📦 Detail Produk:

• Nama: {name}
• Harga: Rp {price:,}
• Kategori: {category}
• Rating: {rating}⭐
• Stok: {stock_status}

📝 Deskripsi:
{description}

🖼️ Foto Produk: {image_url}

🔗 Link Produk: {product_link}"""
>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
        
        return "Produk tidak ditemukan."
            
    except Exception as e:
        logging.error(f"Get product error: {e}")
        return f"Error: {str(e)}"

# ==================== CART TOOLS ====================

@function_tool
async def add_to_cart(product_id: int, quantity: int = 1) -> str:
    """Add a product to the shopping cart. Requires login first."""
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu sebelum bisa nambahin ke keranjang."
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/cart",
            json={"product_id": product_id, "quantity": quantity},
            headers=get_headers(),
            timeout=10
        )
        
        logging.info(f"Add to cart response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                return f"Berhasil ditambahin ke keranjang! {data.get('message', '')}"
        
        return "Gagal nambahin ke keranjang."
            
    except Exception as e:
        logging.error(f"Add to cart error: {e}")
        return f"Error: {str(e)}"

@function_tool
async def get_cart() -> str:
<<<<<<< HEAD:agent/tools.py
    """Get current items in the shopping cart with cart IDs for selective checkout."""
=======
    """Get current items in the shopping cart with cart link."""
>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu buat liat keranjang."
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/cart",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("data", [])
            
            if not items:
                return "Keranjang lo kosong."
            
            result = f"🛒 Keranjang lo ({len(items)} item):\n\n"
            total = 0
            
            for idx, item in enumerate(items, 1):
                product = item.get("products", {})
                subtotal = product.get("price", 0) * item.get("quantity", 1)
                total += subtotal
                
                result += f"{idx}. [Cart ID: {item.get('id')}] {product.get('name', 'Unknown')}\n"
                result += f"   {item.get('quantity')}x Rp {product.get('price', 0):,} = Rp {subtotal:,}\n\n"
            
<<<<<<< HEAD:agent/tools.py
            result += f"Total semua: Rp {total:,}\n\n"
            result += "💡 Untuk checkout sebagian, sebutin Cart ID yang mau di-checkout."
=======
            result += f"💰 Total: Rp {total:,}\n\n"
            result += f"🔗 Link Keranjang: {BASE_URL}/cart"
>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
            return result
        
        return "Gagal mengambil data keranjang."
            
    except Exception as e:
        logging.error(f"Get cart error: {e}")
        return f"Error: {str(e)}"

@function_tool
async def remove_from_cart(cart_id: int) -> str:
    """Remove an item from the cart using cart_id."""
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu."
    
    try:
        response = requests.delete(
            f"{BASE_URL}/api/cart?cart_id={cart_id}",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            return "Item berhasil dihapus dari keranjang!"
        return "Gagal menghapus item."
            
    except Exception as e:
        logging.error(f"Remove from cart error: {e}")
        return f"Error: {str(e)}"

@function_tool
async def update_cart_quantity(cart_id: int, quantity: int) -> str:
    """Update quantity of an item in cart."""
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu."
    
    try:
        response = requests.put(
            f"{BASE_URL}/api/cart",
            json={"cart_id": cart_id, "quantity": quantity},
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                if quantity <= 0:
                    return "Item berhasil dihapus dari keranjang!"
                return f"Quantity berhasil diupdate jadi {quantity}!"
        
        return "Gagal update quantity."
            
    except Exception as e:
        logging.error(f"Update cart error: {e}")
        return f"Error: {str(e)}"

# ==================== CHECKOUT TOOLS ====================

@function_tool
async def checkout(payment_method: str = "GoPay", cart_ids: str = "") -> str:
    """
    Complete the purchase and create an order.
    
    Args:
        payment_method: Payment method. Options: VA_BCA, VA_BRI, VA_Mandiri, GoPay, OVO, ShopeePay, DANA, ShopKuPay
        cart_ids: Comma-separated cart IDs to checkout (e.g., "1,2,3"). Leave empty to checkout ALL items.
    """
<<<<<<< HEAD:agent/tools.py
=======
    # Check voice verification for sensitive action
    print("DEBUG checkout voice:", agent_state["is_voice_verified"])

    voice_error = require_voice_verification("checkout", {"payment_method": payment_method})
    if voice_error:
        return voice_error
    
>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu sebelum checkout."
    
    try:
        # Get cart items first
        cart_response = requests.get(
            f"{BASE_URL}/api/cart",
            headers=get_headers(),
            timeout=10
        )
        
        if cart_response.status_code != 200:
            return "Gagal mengambil data keranjang."
        
        cart_data = cart_response.json()
        all_cart_items = cart_data.get("data", [])
        
        if not all_cart_items:
            return "Keranjang kosong. Gak ada yang bisa di-checkout."
        
        # Filter cart items if cart_ids specified
        if cart_ids:
            selected_ids = [int(id.strip()) for id in cart_ids.split(",") if id.strip().isdigit()]
            cart_items = [item for item in all_cart_items if item.get("id") in selected_ids]
            
            if not cart_items:
                return f"Cart ID {cart_ids} gak ditemukan di keranjang lo."
        else:
            cart_items = all_cart_items
        
        # Calculate total
        total = sum(
            item.get("products", {}).get("price", 0) * item.get("quantity", 1)
            for item in cart_items
        )
        
        # If using ShopKuPay, check balance first
        if payment_method == "ShopKuPay":
            user_response = requests.get(
                f"{BASE_URL}/api/user",
                headers=get_headers(),
                timeout=10
            )
            if user_response.status_code == 200:
                user_data = user_response.json()
                balance = user_data.get("data", {}).get("balance", 0)
                if balance < total:
                    return f"Saldo ShopKuPay tidak cukup. Saldo: Rp {balance:,}, Total: Rp {total:,}"
        
        # Prepare items for order
        items = []
        for item in cart_items:
            product = item.get("products", {})
            items.append({
                "product_id": product.get("id"),
                "quantity": item.get("quantity"),
                "price": product.get("price"),
                "name": product.get("name"),
            })
        
        # Create order
        response = requests.post(
            f"{BASE_URL}/api/orders",
            json={"payment_method": payment_method, "items": items},
            headers=get_headers(),
            timeout=10
        )
        
        logging.info(f"Checkout response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                order = data.get("data", {})
                
                # Clear only checked out cart items
                for item in cart_items:
                    requests.delete(
                        f"{BASE_URL}/api/cart?cart_id={item.get('id')}",
                        headers=get_headers(),
                        timeout=5
                    )
                
                items_count = len(cart_items)
                return f"""🎉 Pesanan berhasil dibuat!
<<<<<<< HEAD:agent/tools.py
Order ID: {order.get('id')}
Jumlah Item: {items_count} produk
Metode Bayar: {payment_method}
Total: Rp {order.get('total', 0):,}
Status: {order.get('status', 'pending')}"""
=======

📦 Order ID: {order.get('id')}
💳 Metode Bayar: {payment_method}
💰 Total: Rp {order.get('total', 0):,}
📋 Status: {order.get('status', 'pending')}

🔗 Link Pesanan: {BASE_URL}/orders/{order.get('id')}
🔗 Semua Pesanan: {BASE_URL}/orders"""
>>>>>>> d4bb1def4f77df05efe477e0df820514c6f97295:backend/agent/tools.py
            else:
                return f"Checkout gagal: {data.get('message', 'Unknown error')}"
        
        return f"Checkout gagal dengan status {response.status_code}"
            
    except Exception as e:
        logging.error(f"Checkout error: {e}")
        return f"Checkout error: {str(e)}"

# ==================== ORDER TOOLS ====================

@function_tool
async def get_order_history() -> str:
    """Get order history with links."""
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu buat liat riwayat pesanan."
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/orders",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            orders = data.get("data", [])
            
            if not orders:
                return "Belum ada pesanan."
            
            result = f"📋 Riwayat pesanan ({len(orders)}):\n\n"
            for order in orders[:10]:
                status_label = {
                    "pending": "⏳ Menunggu Pembayaran",
                    "paid": "✅ Dibayar",
                    "shipped": "🚚 Dikirim",
                    "completed": "✔️ Selesai",
                    "cancelled": "❌ Dibatalkan"
                }.get(order.get('status'), order.get('status'))
                
                result += f"• Order #{order.get('id')}\n"
                result += f"  Total: Rp {order.get('total', 0):,}\n"
                result += f"  Status: {status_label}\n"
                result += f"  Metode Bayar: {order.get('payment_method', '-')}\n"
                result += f"  🔗 Link: {BASE_URL}/orders/{order.get('id')}\n\n"
            
            result += f"🔗 Lihat Semua Pesanan: {BASE_URL}/orders"
            return result
        
        return "Gagal mengambil riwayat pesanan."
            
    except Exception as e:
        logging.error(f"Get orders error: {e}")
        return f"Error: {str(e)}"

@function_tool
async def get_order_detail(order_id: int) -> str:
    """Get detailed information about a specific order by order ID."""
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu buat liat detail pesanan."
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/orders/{order_id}",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            order = data.get("data", {})
            
            if not order:
                return f"Order #{order_id} gak ditemukan."
            
            status_label = {
                "pending": "⏳ Menunggu Pembayaran",
                "paid": "✅ Dibayar",
                "shipped": "🚚 Dikirim",
                "completed": "✔️ Selesai",
                "cancelled": "❌ Dibatalkan"
            }.get(order.get('status'), order.get('status'))
            
            result = f"📦 Detail Order #{order.get('id')}:\n\n"
            result += f"📋 Status: {status_label}\n"
            result += f"💳 Metode Bayar: {order.get('payment_method', '-')}\n"
            result += f"💰 Total: Rp {order.get('total', 0):,}\n\n"
            
            result += "🛍️ Produk yang dipesan:\n"
            items = order.get("order_items", [])
            for item in items:
                subtotal = item.get('price_at_purchase', 0) * item.get('quantity', 1)
                result += f"• {item.get('name_snapshot', 'Unknown')}\n"
                result += f"  {item.get('quantity')}x Rp {item.get('price_at_purchase', 0):,} = Rp {subtotal:,}\n"
            
            result += f"\n🔗 Link Pesanan: {BASE_URL}/orders/{order_id}"
            
            if order.get('status') == 'pending':
                result += f"\n\n⚠️ Pesanan ini belum dibayar. Mau bayar sekarang?"
            
            return result
        
        return f"Order #{order_id} tidak ditemukan."
            
    except Exception as e:
        logging.error(f"Get order detail error: {e}")
        return f"Error: {str(e)}"

@function_tool
async def pay_order(order_id: int) -> str:
    """Pay for a pending order. Only works for orders with 'pending' status."""
    if not auth_state["is_logged_in"]:
        return "Lo harus login dulu sebelum bayar."
    
    try:
        # First check if order exists and is pending
        check_response = requests.get(
            f"{BASE_URL}/api/orders/{order_id}",
            headers=get_headers(),
            timeout=10
        )
        
        if check_response.status_code != 200:
            return f"Order #{order_id} gak ditemukan."
        
        order_data = check_response.json().get("data", {})
        
        if order_data.get("status") != "pending":
            status_label = {
                "paid": "sudah dibayar",
                "shipped": "sudah dikirim",
                "completed": "sudah selesai",
                "cancelled": "sudah dibatalkan"
            }.get(order_data.get('status'), order_data.get('status'))
            return f"Order #{order_id} {status_label}, gak bisa dibayar lagi."
        
        # Process payment
        response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/pay",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                return f"🎉 Pembayaran berhasil!\nOrder #{order_id} sudah dibayar.\nTotal: Rp {order_data.get('total', 0):,}"
        
        return "Pembayaran gagal. Coba lagi nanti."
            
    except Exception as e:
        logging.error(f"Pay order error: {e}")
        return f"Error: {str(e)}"