/* document.addEventListener("DOMContentLoaded", function () {
  const API_KEY = "1b7e8832-3614-4820-a3ca-58d12afb1f44"; // Replace with your actual API key
  const userEmailDisplay = document.getElementById("student_email");
  const logoutBtn = document.getElementById("logout-btn");
  const busStatusContainer = document.getElementById("bus-status-container");
  const notificationContainer = document.getElementById(
    "notification-container"
  );
  const routeSelect = document.getElementById("bus-route-select");
  const routeInfo = document.getElementById("route-info");
  const routeDetails = document.getElementById("route-details");

  let map;
  let busMarkers = {};
  let routePolylines = {};
  let socket;
  let currentFilter = "";

  // Bus stop coordinates
  const busStops = {
    APK: { lat: 25.754, lng: -28.216, name: "APK Campus" },
    APB: { lat: 25.753, lng: -28.215, name: "APB Campus" },
    DFC: { lat: 25.755, lng: -28.217, name: "DFC Campus" },
    SOWETO: { lat: 25.756, lng: -28.22, name: "Soweto Campus" },
  };

  // Route Definitions
  const routes = {
    "APK-APB": {
      name: "APK to APB",
      stops: ["APK", "APB"],
      path: [
        { lat: 25.754, lng: -28.216 },
        { lat: 25.7538, lng: -28.2155 },
        { lat: 25.753, lng: -28.215 },
      ],
      color: "#FF0000",
    },
    "APK-DFC": {
      name: "APK to DFC",
      stops: ["APK", "DFC"],
      path: [
        { lat: 25.754, lng: -28.216 },
        { lat: 25.7545, lng: -28.2165 },
        { lat: 25.755, lng: -28.217 },
      ],
      color: "#00FF00",
    },
    "DFC-APB": {
      name: "DFC to APB",
      stops: ["DFC", "APB"],
      path: [
        { lat: 25.755, lng: -28.217 },
        { lat: 25.754, lng: -28.216 },
        { lat: 25.753, lng: -28.215 },
      ],
      color: "#0000FF",
    },
    "DFC-APK": {
      name: "DFC to APK",
      stops: ["DFC", "APK"],
      path: [
        { lat: 25.755, lng: -28.217 },
        { lat: 25.7545, lng: -28.2165 },
        { lat: 25.754, lng: -28.216 },
      ],
      color: "#FFA500",
    },
    "APK-SOWETO": {
      name: "APK to Soweto",
      stops: ["APK", "SOWETO"],
      path: [
        { lat: 25.754, lng: -28.216 },
        { lat: 25.7545, lng: -28.218 },
        { lat: 25.756, lng: -28.22 },
      ],
      color: "#800080",
    },
  };

  // Check authentication - Use session data from template instead of localStorage
  const userEmail = document.getElementById("student_email").textContent.trim();
  if (userEmail === "Not logged in") {
    window.location.href = "/login";
    return;
  }

  // Logout functionality - Fixed comma syntax error
  logoutBtn.addEventListener("click", function (e) {
    e.preventDefault();
    // Clear any client-side data if needed
    window.location.href = "/logout";
  });

  // Route selector change handler - Fixed variable name
  routeSelect.addEventListener("change", function () {
    currentFilter = this.value;
    filterBusesByRoute();
    if (currentFilter) {
      const route = routes[currentFilter];
      if (route) {
        routeDetails.textContent = `Route: ${
          route.name
        } | Stops: ${route.stops.join(" → ")}`;
        routeInfo.style.display = "block";
      }
    } else {
      routeInfo.style.display = "none";
    }
  });

  // Initialize map
  function initMap() {
    const campusCenter = { lat: 25.754, lng: -28.216 };

    map = new google.maps.Map(document.getElementById("map"), {
      center: campusCenter,
      zoom: 14,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    addBusStopMarkers();
    addRoutePolylines();
    connectSocket();
    loadBusData();
  }

  // Fixed function name typo
  function addBusStopMarkers() {
    for (const [code, stop] of Object.entries(busStops)) {
      new google.maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map: map,
        title: stop.name,
        icon: {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="#2196F3" stroke="white" stroke-width="3"/>
              <text x="16" y="20" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${code}</text>
            </svg>
          `),
          scaledSize: new google.maps.Size(32, 32),
        },
      });
    }
  }

  function addRoutePolylines() {
    for (const [routeCode, route] of Object.entries(routes)) {
      const polyline = new google.maps.Polyline({
        path: route.path,
        geodesic: true,
        strokeColor: route.color,
        strokeOpacity: 0.6,
        strokeWeight: 4,
        map: map,
      });

      routePolylines[routeCode] = polyline;
    }
  }

  function connectSocket() {
    socket = io();

    socket.on("connect", () => {
      showNotification("Connected to real-time tracking service", "success");
      console.log("Socket connected");
    });

    socket.on("disconnect", () => {
      showNotification(
        "Disconnected from real-time tracking service. Reconnecting...",
        "warning"
      );
    });

    socket.on("bus_location", (data) => {
      console.log("Received bus location:", data);
      updateBusMarker(data);
      updateBusStatus(data);
    });

    socket.on("bus_breakdown", (data) => {
      showNotification("Bus " + data.bus_id + " is broken down", "danger");
      updateBusStatus({
        bus_id: data.bus_id,
        status: "Breakdown",
        route: data.route,
      });
    });

    socket.on("bus_near", (data) => {
      showNotification(
        `Bus ${data.bus_id} is arriving at ${data.stop} stop!`,
        "info"
      );
    });

    socket.on("route_update", (data) => {
      console.log("Route update received:", data);
    });
  }

  async function loadBusData() {
    try {
      const response = await fetch("/api/buses");
      const buses = await response.json();
      buses.forEach((bus) => {
        updateBusMarker(bus);
        updateBusStatus(bus);
      });

      // Clear loading message
      if (document.querySelector("#bus-status-container .text-muted")) {
        busStatusContainer.innerHTML = "";
      }
    } catch (error) {
      console.error("Error loading bus data:", error);
      showNotification("Error loading bus data", "danger");
    }
  }

  // Fixed function name typo
  function updateBusMarker(busData) {
    if (!map) return;

    const position = {
      lat: parseFloat(busData.latitude),
      lng: parseFloat(busData.longitude),
    };

    if (busMarkers[busData.bus_id]) {
      busMarkers[busData.bus_id].setPosition(position);
      // Update info window content - Fixed variable name typo
      const infoWindow = busMarkers[busData.bus_id].infoWindow;
      if (infoWindow) {
        infoWindow.setContent(createInfoWindowContent(busData));
      }
    } else {
      const markerIcon = {
        url:
          busData.status === "Breakdown"
            ? "data:image/svg+xml;charset=UTF-8," +
              encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="15" fill="#dc3545" stroke="white" stroke-width="3"/>
              <text x="20" y="24" text-anchor="middle" fill="white" font-size="12" font-weight="bold">🚌</text>
            </svg>
          `)
            : "data:image/svg+xml;charset=UTF-8," +
              encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="15" fill="#28a745" stroke="white" stroke-width="3"/>
              <text x="20" y="24" text-anchor="middle" fill="white" font-size="12" font-weight="bold">🚌</text>
            </svg>
          `),
        scaledSize: new google.maps.Size(40, 40),
      };

      const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: `Bus ${busData.bus_id}`,
        icon: markerIcon,
        animation: google.maps.Animation.DROP,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(busData),
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

      marker.infoWindow = infoWindow;
      busMarkers[busData.bus_id] = marker;
    }

    // Apply route filter
    filterBusesByRoute();
  }

  function createInfoWindowContent(busData) {
    return `
      <div style="min-width: 200px;">
        <h5>Bus ${busData.bus_id}</h5>
        <p><strong>Route:</strong> ${busData.route || "Unknown"}</p>
        <p><strong>Status:</strong> ${busData.status}</p>
        <p><strong>Speed:</strong> ${busData.speed || 0} km/h</p>
        <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
      </div>
    `;
  }

  function filterBusesByRoute() {
    Object.keys(busMarkers).forEach((busId) => {
      const marker = busMarkers[busId];
      const busElement = document.getElementById(`bus-${busId}`);

      if (
        currentFilter === "" ||
        (busElement && busElement.dataset.route === currentFilter)
      ) {
        marker.setVisible(true);
        if (busElement) busElement.style.display = "block";
      } else {
        marker.setVisible(false);
        if (busElement) busElement.style.display = "none";
      }
    });
  }

  function updateBusStatus(busData) {
    let busElement = document.getElementById(`bus-${busData.bus_id}`);

    if (!busElement) {
      if (busStatusContainer.querySelector(".text-muted")) {
        busStatusContainer.innerHTML = "";
      }

      busElement = document.createElement("div");
      busElement.id = `bus-${busData.bus_id}`;
      busElement.classList.add("bus-info-card", "card");
      busElement.dataset.route = busData.route;
      busStatusContainer.appendChild(busElement);
    }

    let statusClass = "bus-status-normal";
    if (busData.status === "Delayed") {
      statusClass = "bus-status-delayed";
    } else if (busData.status === "Breakdown") {
      statusClass = "bus-status-breakdown";
    }

    busElement.className = "bus-info-card card " + statusClass;
    busElement.dataset.route = busData.route;

    // Fixed variable name typo
    busElement.innerHTML = `
      <div class="card-body p-2">
        <h6 class="card-title">Bus ${busData.bus_id}</h6>
        <p class="card-text mb-1">
          <strong>Route:</strong> ${busData.route || "Unknown"}
        </p>
        <p class="card-text mb-1">
          <strong>Status:</strong> ${busData.status}
        </p>
        <p class="card-text mb-0">
          <small class="text-muted">Updated: ${new Date().toLocaleTimeString()}</small>
        </p>
      </div>
    `;

    // Apply current filter
    filterBusesByRoute();
  }

  function showNotification(message, type) {
    if (notificationContainer.querySelector(".text-muted")) {
      notificationContainer.innerHTML = "";
    }

    const notification = document.createElement("div");
    notification.className = `notification-item alert alert-${type} mb-0`;
    notification.innerHTML = `
      <small>${message}</small>
      <small class="d-block text-muted">${new Date().toLocaleTimeString()}</small>
    `;

    notificationContainer.insertBefore(
      notification,
      notificationContainer.firstChild
    );

    // Keep only last 10 notifications - Fixed syntax error
    while (notificationContainer.children.length > 10) {
      notificationContainer.removeChild(notificationContainer.lastChild);
    }
  }

  // Initialize Google Maps
  window.initializeMap = initMap;

  // Load Google Maps API (replace API with your actual key)
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDk5C_4YF_QG-lM9daS5Su4rb8Ns-iZmDE&callback=initializeMap`;
  script.defer = true;
  script.async = true;
  document.body.appendChild(script);
});
 */

// Bus Tracking JavaScript
class BusTracker {
  constructor() {
      this.map = null;
      this.markers = {};
      this.socket = null;
      this.selectedRoute = '';
      this.buses = [];
      
      this.initializeMap();
      this.initializeSocket();
      this.setupEventListeners();
      this.loadInitialData();
  }

   // Check authentication - Use session data from template instead of localStorage
   async checkAuthentication() {
      const userEmail = document.getElementById("student_email").textContent.trim();
      if (userEmail === "Not logged in") {
          window.location.href = "/login";
          return;
      }
   }

      
  // Logout button functionality - Fixed comma syntax error
async logoutBtn() {
  e.preventDefault();
  // Clear any client-side data if needed
  window.location.href = "/logout";
}


  // Initialize the map (assuming you're using a mapping library like Leaflet or Google Maps)
  initializeMap() {
      // Example using Leaflet - you'll need to include Leaflet CSS/JS in your HTML
      // Replace with your preferred mapping solution
      this.map = L.map('map').setView([-25.7479, 28.2293], 12); // Centered on Johannesburg area
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      // Custom bus icon
      this.busIcon = L.icon({
          iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQgMTZIMjBWNkg0VjE2Wk02IDEwSDhWMTJINlYxMFpNMTAgMTBIMTJWMTJIMTBWMTBaTTE0IDEwSDE2VjEySDEzVjEwWk0xOCAxMEgyMFYxMkgxOFYxMFoiIGZpbGw9IiMwMDc5RkYiLz4KPC9zdmc+',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -15]
      });
  }

  // Initialize Socket.IO connection
  initializeSocket() {
      this.socket = io();
      
      this.socket.on('connect', () => {
          console.log('Connected to server');
      });

      this.socket.on('bus_location_update', (data) => {
          this.updateBusLocation(data);
      });

      this.socket.on('new_notification', (data) => {
          this.addNotification(data.message);
      });

      this.socket.on('test', (data) => {
          console.log('Test message:', data.message);
      });
  }

  // Setup event listeners
  setupEventListeners() {
      const routeSelect = document.getElementById('bus-route-select');
      routeSelect.addEventListener('change', (e) => {
          this.selectedRoute = e.target.value;
          this.filterBusesByRoute();
          this.updateRouteInfo();
      });

      // Auto-refresh data every 30 seconds
      setInterval(() => {
          this.loadBusData();
      }, 30000);

      // Auto-refresh notifications every 60 seconds
      setInterval(() => {
          this.loadNotifications();
      }, 60000);
  }

  // Load initial data
  async loadInitialData() {
      await this.loadBusData();
      await this.loadNotifications();
  }

  // Load bus data from API
  async loadBusData() {
      try {
          const route = this.selectedRoute ? `?route=${this.selectedRoute}` : '';
          const response = await fetch(`/get_buses${route}`);
          const buses = await response.json();
          
          this.buses = buses;
          this.updateBusMarkers(buses);
          this.updateBusStatus(buses);
      } catch (error) {
          console.error('Error loading bus data:', error);
          this.showError('Failed to load bus data');
      }
  }

  // Update bus markers on map
  updateBusMarkers(buses) {
      // Clear existing markers
      Object.values(this.markers).forEach(marker => {
          this.map.removeLayer(marker);
      });
      this.markers = {};

      // Add new markers
      buses.forEach(bus => {
          if (bus.lat && bus.lng) {
              const marker = L.marker([bus.lat, bus.lng], { icon: this.busIcon })
                  .addTo(this.map);
              
              const popupContent = `
                  <div class="bus-popup">
                      <h6>Bus ${bus.bus_id}</h6>
                      <p><strong>Route:</strong> ${bus.route || 'N/A'}</p>
                      <p><strong>Status:</strong> <span class="status-${bus.status}">${this.formatStatus(bus.status)}</span></p>
                  </div>
              `;
              marker.bindPopup(popupContent);
              
              this.markers[bus.bus_id] = marker;
          }
      });
  }

  // Update single bus location (from socket)
  updateBusLocation(data) {
      const { bus_id, lat, lng, status, route } = data;
      
      // Update marker position
      if (this.markers[bus_id]) {
          this.markers[bus_id].setLatLng([lat, lng]);
          
          const popupContent = `
              <div class="bus-popup">
                  <h6>Bus ${bus_id}</h6>
                  <p><strong>Route:</strong> ${route || 'N/A'}</p>
                  <p><strong>Status:</strong> <span class="status-${status}">${this.formatStatus(status)}</span></p>
              </div>
          `;
          this.markers[bus_id].getPopup().setContent(popupContent);
      } else {
          // Create new marker
          const marker = L.marker([lat, lng], { icon: this.busIcon })
              .addTo(this.map);
          
          const popupContent = `
              <div class="bus-popup">
                  <h6>Bus ${bus_id}</h6>
                  <p><strong>Route:</strong> ${route || 'N/A'}</p>
                  <p><strong>Status:</strong> <span class="status-${status}">${this.formatStatus(status)}</span></p>
              </div>
          `;
          marker.bindPopup(popupContent);
          
          this.markers[bus_id] = marker;
      }

      // Update bus in local array
      const busIndex = this.buses.findIndex(b => b.bus_id === bus_id);
      if (busIndex >= 0) {
          this.buses[busIndex] = { bus_id, lat, lng, status, route };
      } else {
          this.buses.push({ bus_id, lat, lng, status, route });
      }

      // Update status display
      this.updateBusStatus(this.buses);
  }

  // Update bus status panel
  updateBusStatus(buses) {
      const container = document.getElementById('bus-status-container');
      
      if (buses.length === 0) {
          container.innerHTML = '<div class="p-3 text-center text-muted">No buses available</div>';
          return;
      }

      const filteredBuses = this.selectedRoute 
          ? buses.filter(bus => bus.route === this.selectedRoute)
          : buses;

      if (filteredBuses.length === 0) {
          container.innerHTML = '<div class="p-3 text-center text-muted">No buses for selected route</div>';
          return;
      }

      let html = '';
      filteredBuses.forEach(bus => {
          const statusClass = this.getStatusClass(bus.status);
          html += `
              <div class="bus-status-item p-3 border-bottom">
                  <div class="d-flex justify-content-between align-items-center">
                      <div>
                          <h6 class="mb-1">Bus ${bus.bus_id}</h6>
                          <small class="text-muted">${bus.route || 'No route assigned'}</small>
                      </div>
                      <span class="badge ${statusClass}">${this.formatStatus(bus.status)}</span>
                  </div>
              </div>
          `;
      });

      container.innerHTML = html;
  }

  // Filter buses by selected route
  filterBusesByRoute() {
      // Re-update markers with filtered data
      const filteredBuses = this.selectedRoute 
          ? this.buses.filter(bus => bus.route === this.selectedRoute)
          : this.buses;
      
      this.updateBusMarkers(filteredBuses);
      this.updateBusStatus(this.buses); // Pass all buses to maintain proper filtering in status panel
  }

  // Update route information
  updateRouteInfo() {
      const routeInfo = document.getElementById('route-info');
      const routeDetails = document.getElementById('route-details');
      
      if (this.selectedRoute) {
          const routeDescriptions = {
              'APK-APB': 'Route from APK Campus to APB Campus',
              'APK-DFC': 'Route from APK Campus to DFC Campus',
              'DFC-APB': 'Route from DFC Campus to APB Campus',
              'DFC-APK': 'Route from DFC Campus to APK Campus',
              'APK-SOWETO': 'Route from APK Campus to Soweto'
          };
          
          routeDetails.textContent = routeDescriptions[this.selectedRoute] || 'Route information not available';
          routeInfo.style.display = 'block';
      } else {
          routeInfo.style.display = 'none';
      }
  }

  // Load notifications
  async loadNotifications() {
      try {
          const response = await fetch('/notifications');
          const notifications = await response.json();
          this.displayNotifications(notifications);
      } catch (error) {
          console.error('Error loading notifications:', error);
      }
  }

  // Display notifications
  displayNotifications(notifications) {
      const container = document.getElementById('notification-container');
      
      if (notifications.length === 0) {
          container.innerHTML = '<div class="notification-item text-center text-muted p-3">No notifications yet</div>';
          return;
      }

      let html = '';
      notifications.forEach(notification => {
          const timeAgo = this.timeAgo(new Date(notification.timestamp));
          html += `
              <div class="notification-item p-3 border-bottom">
                  <div class="notification-message">${notification.message}</div>
                  <small class="text-muted">${timeAgo}</small>
              </div>
          `;
      });

      container.innerHTML = html;
  }

  // Add new notification (from socket)
  addNotification(message) {
      const container = document.getElementById('notification-container');
      const newNotification = `
          <div class="notification-item p-3 border-bottom bg-light">
              <div class="notification-message">${message}</div>
              <small class="text-muted">Just now</small>
          </div>
      `;
      
      container.insertAdjacentHTML('afterbegin', newNotification);
      
      // Remove the "No notifications" message if it exists
      const noNotifications = container.querySelector('.text-center.text-muted');
      if (noNotifications && noNotifications.textContent.includes('No notifications')) {
          noNotifications.remove();
      }

      // Keep only the latest 5 notifications
      const notifications = container.querySelectorAll('.notification-item');
      if (notifications.length > 5) {
          notifications[notifications.length - 1].remove();
      }
  }

  // Utility functions
  formatStatus(status) {
      const statusMap = {
          'active': 'Active',
          'inactive': 'Inactive',
          'maintenance': 'Maintenance',
          'delayed': 'Delayed',
          'on_route': 'On Route',
          'at_stop': 'At Stop'
      };
      return statusMap[status] || status;
  }

  getStatusClass(status) {
      const classMap = {
          'active': 'bg-success',
          'on_route': 'bg-success',
          'inactive': 'bg-secondary',
          'maintenance': 'bg-warning',
          'delayed': 'bg-danger',
          'at_stop': 'bg-info'
      };
      return classMap[status] || 'bg-secondary';
  }

  timeAgo(date) {
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      return 'Just now';
  }

  showError(message) {
      // Create a simple error notification
      const errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
      errorDiv.style.cssText = 'top: 80px; right: 20px; z-index: 1050; min-width: 300px;';
      errorDiv.innerHTML = `
          ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `;
      document.body.appendChild(errorDiv);

      // Auto-remove after 5 seconds
      setTimeout(() => {
          if (errorDiv.parentNode) {
              errorDiv.parentNode.removeChild(errorDiv);
          }
      }, 5000);
  }
}

// Initialize the bus tracker when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.busTracker = new BusTracker();
});

// Additional utility functions for admin/testing purposes
window.simulateBusUpdate = function(busId, lat, lng, status, route) {
  if (window.busTracker && window.busTracker.socket) {
      window.busTracker.socket.emit('bus_location_update', {
          bus_id: busId,
          lat: lat,
          lng: lng,
          status: status,
          route: route
      });
  }
};

window.testNotification = function(message) {
  if (window.busTracker && window.busTracker.socket) {
      window.busTracker.socket.emit('new_notification', {
          message: message
      });
  }
};
