const state = {
  products: [],
  cart: {},
  category: "All",
  search: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function getCartItems() {
  return Object.entries(state.cart)
    .map(([id, quantity]) => {
      const product = state.products.find((item) => item.id === Number(id));
      return product ? { ...product, quantity } : null;
    })
    .filter(Boolean);
}

function getCartTotal() {
  return getCartItems().reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
}

function getCartCount() {
  return getCartItems().reduce((total, item) => total + item.quantity, 0);
}

async function loadProducts() {
  const grid = $("#products");

  if (!grid) {
    console.error('Product grid "#products" was not found.');
    return;
  }

  grid.innerHTML = '<div class="empty-state">Loading products...</div>';

  try {
    const response = await fetch("/api/products");

    if (!response.ok) {
      throw new Error("Could not load products.");
    }

    state.products = await response.json();
    renderProducts();
    renderCart();
    setupCategoryFilters();
  } catch (error) {
    console.error(error);
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Unable to load products</h3>
        <p>Please refresh the page and try again.</p>
      </div>`;
  }
}

function renderProducts() {
  const grid = $("#products");
  if (!grid) return;

  const searchTerm = state.search.toLowerCase().trim();

  const filtered = state.products.filter((product) => {
    const matchesCategory =
      state.category === "All" ||
      product.category?.toLowerCase() === state.category.toLowerCase();

    const searchableText = [
      product.name,
      product.category,
      product.description
    ].join(" ").toLowerCase();

    return matchesCategory && searchableText.includes(searchTerm);
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No products found</h3>
        <p>Try another search or category.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((product) => `
    <article class="product-card">
      <div class="product-image" style="background:${escapeHTML(product.color || "#eff1e9")}">
        <span>${escapeHTML(product.emoji || "🛍️")}</span>
        <span class="product-badge">Student pick</span>
      </div>
      <div class="product-info">
        <div class="product-category">${escapeHTML(product.category || "Campus essentials")}</div>
        <h3>${escapeHTML(product.name)}</h3>
        <p class="product-description">${escapeHTML(product.description || "A great choice for campus life.")}</p>
        <div class="product-rating">★ ${escapeHTML(product.rating ?? "4.5")} <span style="color:#777970">/ 5</span></div>
        <div class="product-bottom">
          <span class="product-price">${money(product.price)}</span>
          <button class="add-to-cart" type="button"
            data-add="${Number(product.id)}"
            aria-label="Add ${escapeHTML(product.name)} to cart"
            title="Add to cart">+</button>
        </div>
      </div>
    </article>
  `).join("");
}

function setupCategoryFilters() {
  const containers = $$(".category-filters, .filter-buttons, .filter-row");
  if (!containers.length) return;

  // If the page already has category buttons, use them.
  let buttons = $$(".category-filter, .filter-button, .category-btn");

  if (!buttons.length) {
    const container = containers[0];
    const categories = ["All", ...new Set(
      state.products.map((product) => product.category).filter(Boolean)
    )];

    container.innerHTML = categories.map((category) => `
      <button type="button"
        class="category-filter ${category === "All" ? "active" : ""}"
        data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>
    `).join("");

    buttons = $$(".category-filter");
  }

  buttons.forEach((button) => {
    const value =
      button.dataset.category ||
      button.dataset.filter ||
      button.textContent.trim();

    button.classList.toggle(
      "active",
      value.toLowerCase() === state.category.toLowerCase()
    );
  });
}

function updateCartCount() {
  const count = getCartCount();

  [
    "#cart-count",
    "#cart-count-badge",
    "[data-cart-count]"
  ].forEach((selector) => {
    $$(selector).forEach((element) => {
      element.textContent = count;
      element.hidden = false;
    });
  });
}

function renderCart() {
  const container = $("#cart-items") || $("#cart-content");
  const items = getCartItems();

  if (container) {
    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size:42px">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Find something useful for your campus life.</p>
        </div>`;
    } else {
      container.innerHTML = items.map((item) => `
        <div class="cart-item">
          <div class="cart-item-image">${escapeHTML(item.emoji || "🛍️")}</div>
          <div>
            <h4>${escapeHTML(item.name)}</h4>
            <p>${money(item.price)} each</p>
            <div class="quantity-controls">
              <button type="button" data-quantity="${item.id}" data-change="-1"
                aria-label="Decrease quantity">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-quantity="${item.id}" data-change="1"
                aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button type="button" class="remove-item" data-remove="${item.id}">
            Remove
          </button>
        </div>
      `).join("");
    }
  }

  [
    "#cart-total",
    "#cart-subtotal",
    "[data-cart-total]"
  ].forEach((selector) => {
    $$(selector).forEach((element) => {
      element.textContent = money(getCartTotal());
    });
  });

  updateCartCount();

  const checkoutButton =
    $("#checkout-button") || $("#go-to-checkout") || $("[data-checkout]");

  if (checkoutButton) {
    checkoutButton.disabled = items.length === 0;
    checkoutButton.style.opacity = items.length ? "1" : "0.55";
  }
}

function addToCart(id) {
  const product = state.products.find((item) => item.id === Number(id));
  if (!product) return;

  state.cart[id] = (state.cart[id] || 0) + 1;
  renderCart();
  showToast(`${product.name} added to your cart`);
}

function changeQuantity(id, change) {
  const current = state.cart[id] || 0;
  const next = current + Number(change);

  if (next <= 0) {
    delete state.cart[id];
  } else {
    state.cart[id] = next;
  }

  renderCart();
}

function showToast(message) {
  let toast = $("#campuscart-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "campuscart-toast";
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "22px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "100",
      padding: "13px 20px",
      borderRadius: "999px",
      background: "#242522",
      color: "#fff",
      fontSize: "13px",
      boxShadow: "0 8px 25px rgba(0,0,0,.18)",
      maxWidth: "90%",
      textAlign: "center"
    });
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function openCart() {
  const drawer = $("#cart-drawer");
  if (!drawer) return;

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  let overlay = $("#campuscart-cart-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "campuscart-cart-overlay";
    overlay.className = "cart-overlay";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", closeCart);
  }

  requestAnimationFrame(() => overlay.classList.add("open"));
}

function closeCart() {
  const drawer = $("#cart-drawer");
  const overlay = $("#campuscart-cart-overlay");

  drawer?.classList.remove("open");
  drawer?.setAttribute("aria-hidden", "true");
  overlay?.classList.remove("open");

  if (!$("#checkout-overlay")?.classList.contains("open")) {
    document.body.style.overflow = "";
  }
}

function openCheckout() {
  if (!getCartItems().length) {
    showToast("Add a product to your cart first.");
    return;
  }

  closeCart();

  const form = $("#checkout-form");
  if (!form) return;

  let overlay = $("#checkout-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "checkout-overlay";
    overlay.className = "modal-overlay";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "modal-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close checkout");

    // Move the existing checkout form into an overlay if it isn't already there.
    const parent = form.parentElement;
    overlay.appendChild(form);
    form.prepend(closeButton);
    document.body.appendChild(overlay);

    closeButton.addEventListener("click", closeCheckout);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeCheckout();
    });

    // Keep the checkout form inside its modal wrapper.
    form.style.display = "block";
    if (parent && parent !== document.body && parent.children.length === 0) {
      parent.remove();
    }
  }

  overlay.classList.add("open");
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeCheckout() {
  const overlay = $("#checkout-overlay");
  overlay?.classList.remove("open", "active");
  document.body.style.overflow = "";
}

async function submitCheckout(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const nameInput =
    form.querySelector('[name="name"]') ||
    form.querySelector('[name="customer_name"]') ||
    form.querySelector("#customer-name") ||
    form.querySelector("#name");

  const name = nameInput?.value.trim();

  if (!name) {
    showToast("Please enter your name.");
    nameInput?.focus();
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  const originalText = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = "Placing order...";
  }

  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        items: getCartItems().map((item) => ({
          id: item.id,
          quantity: item.quantity
        }))
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || "Checkout failed.");
    }

    state.cart = {};
    renderCart();
    form.reset();
    closeCheckout();

    const orderId = result.order_id ?? result.id ?? "—";
    showToast(`Order placed successfully! Order #${orderId}`);

    // Refresh the cart in case the page has an order summary.
    renderProducts();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not place your order. Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "Place order";
    }
  }
}

// All click actions are handled here, including buttons rendered later.
document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  if (addButton) {
    addToCart(addButton.dataset.add);
    return;
  }

  const quantityButton = event.target.closest("[data-quantity]");
  if (quantityButton) {
    changeQuantity(
      quantityButton.dataset.quantity,
      quantityButton.dataset.change
    );
    return;
  }

  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    delete state.cart[removeButton.dataset.remove];
    renderCart();
    return;
  }

  const categoryButton = event.target.closest(
    ".category-filter, .filter-button, .category-btn"
  );

  if (categoryButton) {
    state.category =
      categoryButton.dataset.category ||
      categoryButton.dataset.filter ||
      categoryButton.textContent.trim();

    setupCategoryFilters();
    renderProducts();
    return;
  }

  if (event.target.closest("#open-cart, #cart-button, [data-open-cart]")) {
    openCart();
    return;
  }

  if (event.target.closest("#close-cart, [data-close-cart]")) {
    closeCart();
    return;
  }

  if (event.target.closest("#checkout-button, #go-to-checkout, [data-checkout]")) {
    openCheckout();
    return;
  }

  if (event.target.closest("#close-checkout, [data-close-checkout]")) {
    closeCheckout();
  }
});

const searchInput = $("#search") || $("#product-search");

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderProducts();
  });
}

const checkoutForm = $("#checkout-form");

if (checkoutForm) {
  checkoutForm.addEventListener("submit", submitCheckout);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeCheckout();
  }
});

loadProducts();
