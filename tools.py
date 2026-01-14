import logging
import requests
from livekit.agents.llm import function_tool
from langchain_community.tools import DuckDuckGoSearchRun

# Base URL untuk e-commerce website
BASE_URL = "https://dummy-ecommerce-tau.vercel.app"

# Global state untuk auth
auth_state = {
    "token": None,
    "user_id": None,
    "username": None,
    "is_logged_in": False
}

def get_headers():
    """Get headers with auth token if logged in"""
    headers = {"Content-Type": "application/json"}
    if auth_state["token"]:
        headers["Authorization"] = f"Bearer {auth_state['token']}"
    return headers

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
    auth_state = {"token": None, "user_id": None, "username": None, "is_logged_in": False}
    return "Berhasil logout."

@function_tool
async def check_login_status() -> str:
    """Check if user is currently logged in."""
    if auth_state["is_logged_in"]:
        return f"Lo udah login sebagai {auth_state['username']}."
    return "Lo belum login. Login dulu ya buat belanja."

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
async def search_product(query: str) -> str:
    """Search for products in the e-commerce website."""
    try:
        response = requests.get(
            f"{BASE_URL}/api/products",
            params={"q": query},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            products = data.get("data", [])
            
            if not products:
                return f"Gak nemu produk untuk '{query}'."
            
            result = f"Ketemu {len(products)} produk untuk '{query}':\n\n"
            for p in products[:10]:
                result += f"• ID: {p['id']} | {p['name']}\n"
                result += f"  Harga: Rp {p['price']:,} | Rating: {p['rating']}⭐\n\n"
            
            return result
        return "Gagal mencari produk."
            
    except Exception as e:
        logging.error(f"Search product error: {e}")
        return f"Search error: {str(e)}"

@function_tool
async def get_product_detail(product_id: int) -> str:
    """Get detailed information about a specific product."""
    try:
        response = requests.get(f"{BASE_URL}/api/products/{product_id}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            p = data.get("data", {})
            
            if not p:
                return f"Produk ID {product_id} gak ditemukan."
            
            return f"""Detail Produk:
• Nama: {p['name']}
• Harga: Rp {p['price']:,}
• Kategori: {p['category']}
• Rating: {p['rating']}⭐
• Stok: {p.get('stock', 'N/A')}"""
        
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
    """Get current items in the shopping cart."""
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
            
            result = f"Keranjang lo ({len(items)} item):\n\n"
            total = 0
            
            for item in items:
                product = item.get("products", {})
                subtotal = product.get("price", 0) * item.get("quantity", 1)
                total += subtotal
                
                result += f"• {product.get('name', 'Unknown')}\n"
                result += f"  {item.get('quantity')}x Rp {product.get('price', 0):,} = Rp {subtotal:,}\n"
                result += f"  (Cart ID: {item.get('id')})\n\n"
            
            result += f"Total: Rp {total:,}"
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

# ==================== CHECKOUT TOOLS ====================

@function_tool
async def checkout(payment_method: str = "GoPay") -> str:
    """
    Complete the purchase and create an order from cart items.
    Payment methods: VA_BCA, VA_BRI, VA_Mandiri, GoPay, OVO, ShopeePay, DANA, ShopKuPay
    """
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
Order ID: {order.get('id')}
Metode Bayar: {payment_method}
Total: Rp {order.get('total', 0):,}
Status: {order.get('status', 'pending')}"""
            else:
                return f"Checkout gagal: {data.get('message', 'Unknown error')}"
        
        return f"Checkout gagal dengan status {response.status_code}"
            
    except Exception as e:
        logging.error(f"Checkout error: {e}")
        return f"Checkout error: {str(e)}"

# ==================== ORDER TOOLS ====================

@function_tool
async def get_order_history() -> str:
    """Get order history."""
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
            
            result = f"Riwayat pesanan ({len(orders)}):\n\n"
            for order in orders[:10]:
                status_label = {
                    "pending": "Menunggu Pembayaran",
                    "paid": "Dibayar",
                    "shipped": "Dikirim",
                    "completed": "Selesai",
                    "cancelled": "Dibatalkan"
                }.get(order.get('status'), order.get('status'))
                
                result += f"• Order #{order.get('id')}\n"
                result += f"  Total: Rp {order.get('total', 0):,}\n"
                result += f"  Status: {status_label}\n"
                result += f"  Metode Bayar: {order.get('payment_method', '-')}\n\n"
            
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
                "pending": "Menunggu Pembayaran",
                "paid": "Dibayar",
                "shipped": "Dikirim",
                "completed": "Selesai",
                "cancelled": "Dibatalkan"
            }.get(order.get('status'), order.get('status'))
            
            result = f"Detail Order #{order.get('id')}:\n\n"
            result += f"Status: {status_label}\n"
            result += f"Metode Bayar: {order.get('payment_method', '-')}\n"
            result += f"Total: Rp {order.get('total', 0):,}\n\n"
            
            result += "Produk yang dipesan:\n"
            items = order.get("order_items", [])
            for item in items:
                subtotal = item.get('price_at_purchase', 0) * item.get('quantity', 1)
                result += f"• {item.get('name_snapshot', 'Unknown')}\n"
                result += f"  {item.get('quantity')}x Rp {item.get('price_at_purchase', 0):,} = Rp {subtotal:,}\n"
            
            if order.get('status') == 'pending':
                result += f"\n⚠️ Pesanan ini belum dibayar. Mau bayar sekarang?"
            
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