import asyncio
import json
import logging
import time

import requests
from langchain_community.tools import DuckDuckGoSearchRun
from livekit.agents.llm import function_tool

from agent.state import agent_state


# Base URL untuk e-commerce website
BASE_URL = "https://dummy-ecommerce-tau.vercel.app"

# Interval untuk re-verifikasi (3 menit)
REVERIFY_INTERVAL = 180

# ==================== GLOBAL AUTH STATE ====================
# State ini akan di-share antara tools dan agent
auth_state = {
    # Login state
    "token": None,
    "user_id": None,
    "username": None,
    "is_logged_in": False,
    
    # Voice verification state
    "voice_score": 0.0,
    "voice_status_detail": "INIT",
    "verify_attempts": 0,

    "voice_feedback_sent": False,
    "force_verify": False,
    "_force_started": False,
    "pending_action": None,
    "pending_params": None,

    # Product cards state
    "last_search_products": [],
    "room_ref": None,  # Will be set by agent
}


def get_headers():
    """Get headers with auth token if logged in"""
    headers = {"Content-Type": "application/json"}
    if auth_state["token"]:
        headers["Authorization"] = f"Bearer {auth_state['token']}"
    return headers


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


def require_voice_verification(action_name: str, params=None) -> str | None:
    """
    Soft gate for sensitive actions (checkout, payment, etc).
    Chat is NEVER blocked.
    """

    status = agent_state.get("voice_status", "UNKNOWN")

    # ✅ Sudah verified → boleh lanjut
    if status == "VERIFIED":
        return None

    # 🟡 Voice belum jelas → minta lanjut ngobrol
    if status == "REPEAT":
        return (
            f"Sebentar ya, suara kamu belum cukup jelas. "
            f"Kita lanjut ngobrol dulu bentar sebelum gue {action_name}."
        )

    # 🔴 Voice ditolak → jelasin batasan, tapi jangan usir
    if status == "DENIED":
        return (
            f"Maaf, suara kamu belum bisa dikenali. "
            f"Kamu tetap bisa browsing dan ngobrol, "
            f"tapi untuk {action_name} fitur ini dibatasi."
        )

    # ⚪ UNKNOWN / belum pernah verifikasi
    return (
        f"Sebelum gue {action_name}, gue perlu memastikan suara kamu dulu. "
        f"Coba ngobrol sebentar ya."
    )

@function_tool
async def send_product_cards(products: list):
    """Send product cards to frontend AND save to database"""
    import json
    import logging
    from db.conversation_logs import insert_conversation_log
    from agent.state import agent_state
    from db.connection import get_supabase
    
    session_id = agent_state.get("conversation_session_id")
    
    if not session_id:
        logging.error("❌ PRODUCT_CARDS NOT SAVED: conversation_session_id is None")
        return
    
    product_cards_json = json.dumps(products[:8], ensure_ascii=False)
    
    # ================================
    # 1️⃣ SAVE TO DATABASE
    # ================================
    try:
        sb = get_supabase()
        
        sb.table("conversation_logs").insert({
            "session_id": str(session_id),
            "role": "assistant",
            "content": f"🛍️ Menampilkan {len(products[:8])} produk",
            "product_cards": product_cards_json  # ← Save to product_cards column (JSONB)
        }).execute()
        
        logging.info(f"✅ PRODUCT_CARDS SAVED TO DB (session={session_id}, count={len(products[:8])})")
    except Exception as e:
        logging.error(f"❌ Failed to save product cards to DB: {e}")
    
    # ================================
    # 2️⃣ SEND TO FRONTEND (Real-time)
    # ================================
    room = auth_state.get("room_ref")
    if room:
        try:
            # ⏰ DELAY 2s
            await asyncio.sleep(2)
            
            payload = json.dumps({
                "type": "PRODUCT_CARDS",
                "products": products[:8]
            }).encode("utf-8")
            
            await room.local_participant.publish_data(
                payload,
                reliable=True,
                topic="PRODUCT_DATA"
            )
            logging.info(f"📤 PRODUCT_CARDS SENT REALTIME")
        except Exception as e:
            logging.error(f"❌ Failed realtime PRODUCT_CARDS: {e}")

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
    auth_state["token"] = None
    auth_state["user_id"] = None
    auth_state["username"] = None
    auth_state["is_logged_in"] = False
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
    status = agent_state["voice_status"]
    
    if is_voice_verified():
        elapsed = int(time.time() - agent_state["last_verified_at"])
        remaining = REVERIFY_INTERVAL - elapsed
        return f"✅ Suara lo udah terverifikasi. Verifikasi aktif {remaining} detik lagi."
    elif status == "EXPIRED":
        return "⚠️ Verifikasi suara lo udah expired. Coba ngomong lagi buat verifikasi ulang."
    elif status == "DENIED":
        return "❌ Verifikasi suara gagal. Coba ngomong lagi dengan jelas."
    else:
        return "⚠️ Suara lo belum diverifikasi. Gue perlu dengar suara lo dulu."


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
    min_rating: float = 0.0,
    sort_by: str = ""
) -> str:
    """
    Search for products in the e-commerce website.
    
    Args:
        query: Search keyword for product name (optional - leave empty to get all products)
        category: Filter by category (Electronics, Fashion, Home, Sports, Books)
        min_price: Minimum price filter
        max_price: Maximum price filter  
        min_rating: Minimum rating filter (0.0-5.0)
        sort_by: Sort results (price_asc, price_desc, rating_desc, newest)
    """
    try:
        params = {}
        
        if query:
            params["q"] = query
        if category:
            params["category"] = category
        if min_price > 0:
            params["min_price"] = min_price
        if max_price > 0:
            params["max_price"] = max_price
        if min_rating > 0:
            params["min_rating"] = min_rating
        if sort_by:
            params["sort"] = sort_by
        
        response = requests.get(
            f"{BASE_URL}/api/products",
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            products = data.get("data", [])
            
            if not products:
                search_term = query if query else "semua kategori"
                return f"Gak nemu produk untuk '{search_term}'."
            
            # Save products for reference
            auth_state["last_search_products"] = products[:10]
            
            # Send product cards to frontend (WITH 2s DELAY)
            await send_product_cards(products[:8])
            
            # Return summary to voice
            search_term = query if query else "pencarian"
            result = f"Oke, gue nemu {len(products)} produk untuk '{search_term}'. "
            result += f"Gue tampilin {min(len(products), 8)} produk di layar. "
            
            # Mention top 3 products
            if len(products) >= 3:
                result += f"Yang paling atas ada {products[0]['name']} harga {products[0]['price']:,}, "
                result += f"{products[1]['name']} harga {products[1]['price']:,}, "
                result += f"sama {products[2]['name']} harga {products[2]['price']:,}. "
            
            result += "Klik salah satu buat liat detail, atau bilang 'tambahin ke keranjang produk nomor X' kalo mau beli."
            
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

                🔗 Link Produk: {product_link}
                """
        
        return "Produk tidak ditemukan."
            
    except Exception as e:
        logging.error(f"Get product error: {e}")
        return f"Error: {str(e)}"

@function_tool
async def get_product_from_search_index(index: int) -> str:
    """
    Get product ID from the last search results by index (1-based).
    Example: User says 'add product number 2 to cart', this returns the 2nd product from last search.
    """
    if not auth_state["last_search_products"]:
        return "Gak ada hasil pencarian sebelumnya. Coba cari produk dulu."
    
    if index < 1 or index > len(auth_state["last_search_products"]):
        return f"Index {index} gak valid. Hasil pencarian cuma ada {len(auth_state['last_search_products'])} produk."
    
    product = auth_state["last_search_products"][index - 1]
    product_id = product.get("id")
    product_name = product.get("name")
    
    return f"Produk nomor {index} adalah {product_name} (ID: {product_id})"

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
    """Get current items in the shopping cart with cart link."""
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
            
            for item in items:
                product = item.get("products", {})
                subtotal = product.get("price", 0) * item.get("quantity", 1)
                total += subtotal
                
                result += f"• {product.get('name', 'Unknown')}\n"
                result += f"  {item.get('quantity')}x Rp {product.get('price', 0):,} = Rp {subtotal:,}\n"
                result += f"  (Cart ID: {item.get('id')})\n\n"
            
            result += f"💰 Total: Rp {total:,}\n\n"
            result += f"🔗 Link Keranjang: {BASE_URL}/cart"
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


# ==================== CHECKOUT TOOLS (PROTECTED - NEED VOICE VERIFICATION) ====================

@function_tool
async def checkout(payment_method: str = "GoPay") -> str:
    """
    Complete the purchase and create an order from cart items.
    Payment methods: VA_BCA, VA_BRI, VA_Mandiri, GoPay, OVO, ShopeePay, DANA, ShopKuPay
    
    ⚠️ This action requires voice verification for security.
    """
    # Check voice verification for sensitive action
    voice_error = require_voice_verification("checkout", {"payment_method": payment_method})
    if voice_error:
        return voice_error
    
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
        cart_items = cart_data.get("data", [])
        
        if not cart_items:
            return "Keranjang kosong. Gak ada yang bisa di-checkout."
        
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
                
                # Clear cart after successful order
                for item in cart_items:
                    requests.delete(
                        f"{BASE_URL}/api/cart?cart_id={item.get('id')}",
                        headers=get_headers(),
                        timeout=5
                    )
                
                return f"""🎉 Pesanan berhasil dibuat!

📦 Order ID: {order.get('id')}
💳 Metode Bayar: {payment_method}
💰 Total: Rp {order.get('total', 0):,}
📋 Status: {order.get('status', 'pending')}

🔗 Link Pesanan: {BASE_URL}/orders/{order.get('id')}
🔗 Semua Pesanan: {BASE_URL}/orders"""
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
    """
    Pay for a pending order. Only works for orders with 'pending' status.
    
    ⚠️ This action requires voice verification for security.
    """
    # Check voice verification for sensitive action
    voice_error = require_voice_verification("bayar order")
    if voice_error:
        return voice_error
    
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