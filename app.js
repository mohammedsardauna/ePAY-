let token = localStorage.getItem("epay_token");

const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed: HTTP ${response.status}`);
  }

  return data;
}

/* -------------------------------
   UI CONTROLS
-------------------------------- */

$("#startBtn").addEventListener("click", () => {
  $("#auth").classList.toggle("hidden");
});

$("#loginBtn").addEventListener("click", () => {
  $("#auth").classList.toggle("hidden");
});

/* -------------------------------
   AUTHENTICATION
-------------------------------- */

async function authenticate(mode) {
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const displayName =
    $("#displayName").value.trim() || "ePAY User";

  const payload = {
    email,
    password,
    displayName
  };

  const data = await api(`/api/auth/${mode}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  token = data.token;

  localStorage.setItem("epay_token", token);

  $("#authMsg").textContent =
    `Welcome, ${data.user.display_name || data.user.email}`;

  $("#authMsg").style.opacity = "1";
}

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await authenticate("register");
  } catch (error) {
    $("#authMsg").textContent = error.message;
  }
});

$("#signin").addEventListener("click", async () => {
  try {
    await authenticate("login");
  } catch (error) {
    $("#authMsg").textContent = error.message;
  }
});

/* -------------------------------
   TRANSACTION CREATION
-------------------------------- */

$("#txForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  $("#txOut").textContent = "Creating transaction...";

  try {
    const idempotencyKey = crypto.randomUUID();

    const payload = {
      assetCode: $("#asset").value.trim().toUpperCase(),
      amount: Number($("#amount").value),
      recipientUserId:
        $("#recipient").value.trim() || undefined
    };

    const data = await api("/api/transactions/create", {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    $("#txOut").textContent =
      JSON.stringify(data, null, 2);

  } catch (error) {
    $("#txOut").textContent =
      `Transaction error: ${error.message}`;
  }
});

/* -------------------------------
   PI NETWORK
-------------------------------- */

$("#piBtn").addEventListener("click", async () => {
  $("#piStatus").textContent =
    "Checking Pi configuration...";

  try {
    const config = await api("/api/pi/config");

    if (!config.enabled) {
      $("#piStatus").textContent =
        "Pi is not configured yet. Add the required Pi environment variables in Vercel.";
      return;
    }

    if (!window.Pi) {
      const script = document.createElement("script");

      script.src = config.sdkUrl;

      script.onload = () => {
        initializePi(config);
      };

      script.onerror = () => {
        $("#piStatus").textContent =
          "Unable to load the Pi SDK.";
      };

      document.head.appendChild(script);
    } else {
      initializePi(config);
    }

  } catch (error) {
    $("#piStatus").textContent =
      `Pi configuration error: ${error.message}`;
  }
});

async function initializePi(config) {
  try {
    if (!window.Pi) {
      throw new Error("Pi SDK unavailable");
    }

    window.Pi.init({
      version: "2.0",
      sandbox: false
    });

    const authentication =
      await window.Pi.authenticate(
        ["username", "payments"],
        () => {
          console.log("Pi incomplete payment detected.");
        }
      );

    $("#piStatus").textContent =
      `Connected as ${
        authentication.user?.username || "Pi user"
      }.`;

  } catch (error) {
    $("#piStatus").textContent =
      `Pi connection failed: ${
        error?.message || error
      }`;
  }
}

/* -------------------------------
   SESSION CHECK
-------------------------------- */

async function loadCurrentUser() {
  if (!token) return;

  try {
    const data = await api("/api/me");

    $("#authMsg").textContent =
      `Signed in as ${
        data.user.display_name ||
        data.user.email
      }`;

  } catch (error) {
    localStorage.removeItem("epay_token");
    token = null;
  }
}

loadCurrentUser();
