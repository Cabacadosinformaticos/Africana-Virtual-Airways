const token = localStorage.getItem('afv_token');

const state = {
  activeSection: 'dashboard',
  currentUser: null,
  selectedRouteId: null,
  lookups: {
    airports: [],
    aircraft: [],
    routeStatuses: []
  },
  routes: [],
  routeSummary: null,
  fleet: [],
  bookings: [],
  users: [],
  vatsim: []
};

const elements = {
  adminUserName: document.getElementById('adminUserName'),
  adminUserInitials: document.getElementById('adminUserInitials'),
  allBookingsTable: document.getElementById('allBookingsTable'),
  addAircraftButton: document.getElementById('addAircraftButton'),
  addScheduleButton: document.getElementById('addScheduleButton'),
  aircraftCategory: document.getElementById('aircraftCategory'),
  aircraftCruiseSpeed: document.getElementById('aircraftCruiseSpeed'),
  aircraftDescription: document.getElementById('aircraftDescription'),
  aircraftForm: document.getElementById('aircraftForm'),
  aircraftHub: document.getElementById('aircraftHub'),
  aircraftId: document.getElementById('aircraftId'),
  aircraftImage: document.getElementById('aircraftImage'),
  aircraftModal: document.getElementById('aircraftModal'),
  aircraftModalSubtitle: document.getElementById('aircraftModalSubtitle'),
  aircraftModalTitle: document.getElementById('aircraftModalTitle'),
  aircraftRangeKm: document.getElementById('aircraftRangeKm'),
  aircraftRegistration: document.getElementById('aircraftRegistration'),
  aircraftSeatsBusiness: document.getElementById('aircraftSeatsBusiness'),
  aircraftSeatsEconomy: document.getElementById('aircraftSeatsEconomy'),
  aircraftSeatsFirst: document.getElementById('aircraftSeatsFirst'),
  aircraftStatus: document.getElementById('aircraftStatus'),
  aircraftType: document.getElementById('aircraftType'),
  bookingSearchInput: document.getElementById('bookingSearchInput'),
  bookingsChart: document.getElementById('bookingsChart'),
  cancelAircraftButton: document.getElementById('cancelAircraftButton'),
  closeAircraftModalButton: document.getElementById('closeAircraftModalButton'),
  dashboardUserName: document.getElementById('dashboardUserName'),
  fleetTable: document.getElementById('fleetTable'),
  globalSearchInput: document.getElementById('globalSearchInput'),
  hubAllocation: document.getElementById('hubAllocation'),
  lastUpdated: document.getElementById('lastUpdated'),
  logoutButton: document.getElementById('logoutButton'),
  operationsPulse: document.getElementById('operationsPulse'),
  recentBookingsTable: document.getElementById('recentBookingsTable'),
  refreshDashboardButton: document.getElementById('refreshDashboardButton'),
  refreshMetricsButton: document.getElementById('refreshMetricsButton'),
  refreshVatsimButton: document.getElementById('refreshVatsimButton'),
  resetRouteFormButton: document.getElementById('resetRouteFormButton'),
  retireAircraftButton: document.getElementById('retireAircraftButton'),
  routeAircraft: document.getElementById('routeAircraft'),
  routeForm: document.getElementById('routeForm'),
  routeFormMeta: document.getElementById('routeFormMeta'),
  routeFormSubtitle: document.getElementById('routeFormSubtitle'),
  routeFormTitle: document.getElementById('routeFormTitle'),
  routeFromAirport: document.getElementById('routeFromAirport'),
  routeHubAirport: document.getElementById('routeHubAirport'),
  routeId: document.getElementById('routeId'),
  routeNewButton: document.getElementById('routeNewButton'),
  routesTable: document.getElementById('routesTable'),
  routeSchedules: document.getElementById('routeSchedules'),
  routeSearchInput: document.getElementById('routeSearchInput'),
  routeStatus: document.getElementById('routeStatus'),
  routeStatusFilter: document.getElementById('routeStatusFilter'),
  routeSummaryActive: document.getElementById('routeSummaryActive'),
  routeSummaryAssigned: document.getElementById('routeSummaryAssigned'),
  routeSummaryHubs: document.getElementById('routeSummaryHubs'),
  routeSummaryTotal: document.getElementById('routeSummaryTotal'),
  routeToAirport: document.getElementById('routeToAirport'),
  saveAircraftButton: document.getElementById('saveAircraftButton'),
  saveRouteButton: document.getElementById('saveRouteButton'),
  sidebarHealth: document.getElementById('sidebarHealth'),
  statBookings: document.getElementById('statBookings'),
  statBookingsMeta: document.getElementById('statBookingsMeta'),
  statFleet: document.getElementById('statFleet'),
  statFleetMeta: document.getElementById('statFleetMeta'),
  statRevenue: document.getElementById('statRevenue'),
  statRevenueMeta: document.getElementById('statRevenueMeta'),
  statRoutes: document.getElementById('statRoutes'),
  statRoutesMeta: document.getElementById('statRoutesMeta'),
  topRoutesTable: document.getElementById('topRoutesTable'),
  toast: document.getElementById('toast'),
  userCreateEmail: document.getElementById('userCreateEmail'),
  userCreateForm: document.getElementById('userCreateForm'),
  userCreateName: document.getElementById('userCreateName'),
  userCreateNotice: document.getElementById('userCreateNotice'),
  userCreatePassword: document.getElementById('userCreatePassword'),
  userCreateRole: document.getElementById('userCreateRole'),
  userCreateSubmit: document.getElementById('userCreateSubmit'),
  userCreateVatsimCid: document.getElementById('userCreateVatsimCid'),
  userSearchInput: document.getElementById('userSearchInput'),
  usersTable: document.getElementById('usersTable'),
  vatsimTable: document.getElementById('vatsimTable')
};

boot();

/**
 * Entry point for the admin back office. Binds all UI event listeners, verifies
 * the stored JWT with the /api/auth/me endpoint, and confirms admin role access.
 * On success, sets the admin identity, loads lookups and initial data in parallel,
 * and updates the sidebar health indicator. Redirects to the public site on failure.
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function boot() {
  bindEvents();

  if (!token) {
    redirectToPublicSite('Please sign in as an admin to access the back office.');
    return;
  }

  try {
    const response = await fetchAdmin('/api/auth/me');
    const user = await response.json();

    if (!response.ok || user.role !== 'admin') {
      throw new Error(user.error || 'Admin access required.');
    }

    state.currentUser = user;
    setAdminIdentity(user);
    await loadLookups();
    await Promise.all([
      loadRoutesWorkspace({ preserveSelection: false }),
      loadFleetTable(),
      loadDashboard()
    ]);
    setSidebarHealth('Connected to the live AFV database');
  } catch (error) {
    redirectToPublicSite(error.message || 'Admin access required.');
  }
}

/**
 * Attaches all event listeners for interactive admin panel elements, including
 * sidebar navigation, dashboard refresh, route form actions, fleet modals,
 * booking/user table interactions, and the global search input.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function bindEvents() {
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ document.querySelectorAll('.admin-side-link').forEach(button => {
    /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the admin dashboard boot, render, and interaction flow. */ button.addEventListener('click', () => showSection(button.dataset.section));
  });

  elements.logoutButton?.addEventListener('click', logout);
  /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the admin dashboard boot, render, and interaction flow. */ elements.refreshDashboardButton?.addEventListener('click', () => loadDashboard(true));
  elements.refreshMetricsButton?.addEventListener('click', () => loadMetrics());
  /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the admin dashboard boot, render, and interaction flow. */ elements.refreshVatsimButton?.addEventListener('click', () => loadVatsim(true));
  elements.routeNewButton?.addEventListener('click', startNewRoute);
  elements.resetRouteFormButton?.addEventListener('click', startNewRoute);
  elements.addScheduleButton?.addEventListener('click', handleAddSchedule);
  elements.routeForm?.addEventListener('submit', handleRouteSubmit);
  elements.routeSearchInput?.addEventListener('input', renderRoutesTable);
  elements.routeStatusFilter?.addEventListener('change', renderRoutesTable);
  elements.routesTable?.addEventListener('click', handleRoutesTableClick);
  /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the admin dashboard boot, render, and interaction flow. */ elements.addAircraftButton?.addEventListener('click', () => openAircraftModal());
  elements.closeAircraftModalButton?.addEventListener('click', closeAircraftModal);
  elements.cancelAircraftButton?.addEventListener('click', closeAircraftModal);
  /* Purpose: responds to the click event for the surrounding DOM element. Connection: wires the surrounding UI element into the admin dashboard boot, render, and interaction flow. */ elements.aircraftModal?.addEventListener('click', event => {
    if (event.target === elements.aircraftModal) closeAircraftModal();
  });
  elements.aircraftForm?.addEventListener('submit', handleAircraftSubmit);
  elements.retireAircraftButton?.addEventListener('click', handleRetireAircraft);
  elements.fleetTable?.addEventListener('click', handleFleetTableClick);
  elements.bookingSearchInput?.addEventListener('input', renderBookingsTable);
  elements.allBookingsTable?.addEventListener('change', handleBookingStatusChange);
  elements.userCreateForm?.addEventListener('submit', handleUserCreate);
  elements.userSearchInput?.addEventListener('input', renderUsersTable);
  elements.usersTable?.addEventListener('change', handleUserRoleChange);
  /* Purpose: responds to the input event for the surrounding DOM element. Connection: wires the surrounding UI element into the admin dashboard boot, render, and interaction flow. */ elements.globalSearchInput?.addEventListener('input', () => applyGlobalSearch(elements.globalSearchInput.value));
  elements.routeSchedules?.addEventListener('click', handleScheduleListClick);
}

/**
 * Populates the admin identity areas (sidebar name, initials, dashboard greeting,
 * role label) using the authenticated user object. Also enables or disables the
 * user create form depending on whether the current user is the primary admin.
 * @param {Object} user - Authenticated user object with name, isPrimaryAdmin fields
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function setAdminIdentity(user) {
  const initials = String(user.name || 'AF')
    .split(' ')
    /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (elements.adminUserName) elements.adminUserName.textContent = user.name;
  if (elements.adminUserInitials) elements.adminUserInitials.textContent = initials || 'AF';
  if (elements.dashboardUserName) elements.dashboardUserName.textContent = user.name || 'Admin';

  const roleLabel = user.isPrimaryAdmin ? 'Main admin session' : 'Admin session';
  const roleElement = document.querySelector('.admin-profile-role');
  if (roleElement) roleElement.textContent = roleLabel;

  if (elements.userCreateNotice) {
    elements.userCreateNotice.textContent = user.isPrimaryAdmin
      ? 'You can create and promote database-backed logins.'
      : 'Only the main admin can create or promote accounts.';
  }

  if (elements.userCreateForm) {
    const disabled = !user.isPrimaryAdmin;
    /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.userCreateForm.querySelectorAll('input, select, button').forEach(field => {
      field.disabled = disabled;
    });
  }
}

/**
 * Shows the specified admin section and hides all others. Updates sidebar link
 * active states and triggers the appropriate data load for the newly visible section.
 * Also re-applies the global search filter to the new section's table rows.
 * @param {string} sectionName - The data-section value of the section to show
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function showSection(sectionName) {
  state.activeSection = sectionName;

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.toggle('hidden', section.dataset.section !== sectionName);
  });

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ document.querySelectorAll('.admin-side-link').forEach(button => {
    button.classList.toggle('active', button.dataset.section === sectionName);
  });

  if (sectionName === 'dashboard') loadDashboard();
  if (sectionName === 'routes') loadRoutesWorkspace();
  if (sectionName === 'fleet') loadFleetTable();
  if (sectionName === 'bookings') loadBookings();
  if (sectionName === 'users') loadUsers();
  if (sectionName === 'metrics') loadMetrics();
  if (sectionName === 'vatsim') loadVatsim();

  applyGlobalSearch(elements.globalSearchInput?.value || '');
}

/**
 * Fetches airport, aircraft, and route-status lookup data from the API and stores
 * it in state.lookups. Populates the route and aircraft hub select dropdowns.
 * Uses cached data on subsequent calls unless force is true.
 * @param {boolean} [force=false] - If true, re-fetches even if lookups are already loaded
 * @returns {Promise<Object>} The raw lookups payload from the API
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function loadLookups(force = false) {
  if (state.lookups.airports.length && !force) return state.lookups;

  const response = await fetchAdmin('/api/admin/lookups');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Could not load route lookups.');
  }

  state.lookups = data;
  populateRouteSelects();
  populateAircraftHubSelect();
  return data;
}

/**
 * Populates the route form's origin, destination, hub, and aircraft select elements
 * using the current lookup data. Pre-selects the values from the given route object
 * if provided.
 * @param {Object|null} [route=null] - Route object to pre-select values for, or null
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function populateRouteSelects(route = null) {
  const airports = state.lookups.airports || [];
  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const hubAirports = airports.filter(airport => airport.hub);
  const aircraft = state.lookups.aircraft || [];

  if (elements.routeFromAirport) {
    elements.routeFromAirport.innerHTML = buildAirportOptions(airports, route?.fromAirport, 'Select origin');
  }

  if (elements.routeToAirport) {
    elements.routeToAirport.innerHTML = buildAirportOptions(airports, route?.toAirport, 'Select destination');
  }

  if (elements.routeHubAirport) {
    elements.routeHubAirport.innerHTML = buildAirportOptions(hubAirports, route?.hubAirport, 'Select hub');
  }

  if (elements.routeAircraft) {
    elements.routeAircraft.innerHTML = buildAircraftOptions(aircraft, route?.aircraftId);
  }
}

/**
 * Populates the aircraft hub select element with hub-only airports from lookups,
 * pre-selecting the given ICAO code if provided.
 * @param {string|null} [selectedHub=null] - ICAO code of the hub to pre-select
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function populateAircraftHubSelect(selectedHub = null) {
  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const hubAirports = (state.lookups.airports || []).filter(airport => airport.hub);
  if (!elements.aircraftHub) return;

  elements.aircraftHub.innerHTML = buildAirportOptions(hubAirports, selectedHub, 'Select hub');
}

/**
 * Builds an HTML string of <option> elements for an airport select dropdown.
 * Marks hub airports with a "• Hub" suffix and pre-selects the given ICAO value.
 * @param {Object[]} airports - Array of airport objects with icao, city, hub fields
 * @param {string|undefined} selectedValue - ICAO code to pre-select
 * @param {string} placeholder - Text for the empty first option
 * @returns {string} HTML string of <option> elements
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildAirportOptions(airports, selectedValue, placeholder) {
  const options = [`<option value="">${placeholder}</option>`];

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ airports.forEach(airport => {
    const label = `${airport.city} (${airport.icao})${airport.hub ? ' • Hub' : ''}`;
    const selected = airport.icao === selectedValue ? ' selected' : '';
    options.push(`<option value="${airport.icao}"${selected}>${escapeHtml(label)}</option>`);
  });

  return options.join('');
}

/**
 * Builds an HTML string of <option> elements for an aircraft select dropdown,
 * with an "Unassigned / TBD" first option. Pre-selects the option matching selectedId.
 * @param {Object[]} aircraftList - Array of aircraft objects with id, registration, type, status
 * @param {number|null} [selectedId=null] - Aircraft ID to pre-select
 * @returns {string} HTML string of <option> elements
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildAircraftOptions(aircraftList, selectedId = null) {
  const options = ['<option value="">Unassigned / TBD</option>'];

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ aircraftList.forEach(aircraft => {
    const selected = Number(selectedId) === Number(aircraft.id) ? ' selected' : '';
    const label = `${aircraft.registration} • ${aircraft.type} • ${aircraft.status}`;
    options.push(`<option value="${aircraft.id}"${selected}>${escapeHtml(label)}</option>`);
  });

  return options.join('');
}

/**
 * Loads dashboard stats, routes summary, and full bookings list in parallel,
 * then renders all dashboard widgets: KPI cards, bookings chart, top routes,
 * recent bookings, operations pulse, and hub allocation. Optionally shows a
 * success toast when called as a manual refresh.
 * @param {boolean} [showSuccessToast=false] - Whether to show a "refreshed" toast
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function loadDashboard(showSuccessToast = false) {
  try {
    const [statsResponse, routesResponse, bookingsResponse] = await Promise.all([
      fetchAdmin('/api/admin/stats'),
      fetchAdmin('/api/admin/routes'),
      fetchAdmin('/api/admin/bookings')
    ]);

    const [stats, routesPayload, bookings] = await Promise.all([
      statsResponse.json(),
      routesResponse.json(),
      bookingsResponse.json()
    ]);

    if (!statsResponse.ok) throw new Error(stats.error || 'Could not load dashboard stats.');
    if (!routesResponse.ok) throw new Error(routesPayload.error || 'Could not load route summary.');
    if (!bookingsResponse.ok) throw new Error(bookings.error || 'Could not load bookings.');

    state.bookings = bookings;
    state.routes = routesPayload.routes;
    state.routeSummary = routesPayload.summary;

    setText(elements.statBookings, formatNumber(stats.totalBookings));
    setText(elements.statBookingsMeta, `${formatNumber(stats.todayBookings)} created today`);
    setText(elements.statRevenue, formatCurrency(stats.totalRevenue));
    setText(elements.statRevenueMeta, `${formatNumber(stats.confirmedBookings)} confirmed bookings`);
    setText(elements.statFleet, formatNumber(stats.activeFleet));
    setText(elements.statFleetMeta, `${formatNumber(routesPayload.summary.routesWithAircraft)} sectors assigned`);
    setText(elements.statRoutes, formatNumber(routesPayload.summary.activeRoutes));
    setText(elements.statRoutesMeta, `${formatNumber(routesPayload.summary.hubs)} hubs represented`);

    renderBookingsChart(bookings);
    renderTopRoutes(stats.topRoutes || []);
    renderRecentBookings(bookings.slice(0, 6));
    renderOperationsPulse(stats, routesPayload.summary);
    renderHubAllocation(state.routes, state.fleet);
    stampLastUpdated();

    if (showSuccessToast) {
      showToast('Dashboard refreshed.', 'success');
    }
  } catch (error) {
    showToast(error.message || 'Could not load dashboard.', 'error');
  }
}

/**
 * Renders a monthly bookings bar chart into the bookingsChart element using
 * normalised bar heights relative to the peak month's count.
 * @param {Object[]} bookings - Full bookings array; uses createdAt to group by month
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderBookingsChart(bookings) {
  if (!elements.bookingsChart) return;

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthCounts = Array(12).fill(0);

  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ bookings.forEach(booking => {
    const date = new Date(booking.createdAt);
    if (!Number.isNaN(date.getTime())) {
      monthCounts[date.getMonth()] += 1;
    }
  });

  const maxValue = Math.max(...monthCounts, 1);
  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.bookingsChart.innerHTML = monthCounts.map((count, index) => `
    <div class="chart-column">
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="height:${Math.max(8, Math.round((count / maxValue) * 100))}%"></div>
      </div>
      <span class="chart-bar-value">${count}</span>
      <span class="chart-bar-label">${monthLabels[index]}</span>
    </div>
  `).join('');
}

/**
 * Renders the top routes table on the dashboard with route codes and booking counts.
 * Shows an empty-state row if no route demand data exists.
 * @param {Object[]} routes - Array of { route, count } objects from the stats API
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderTopRoutes(routes) {
  if (!elements.topRoutesTable) return;

  if (!routes.length) {
    elements.topRoutesTable.innerHTML = buildEmptyRow(2, 'No route demand data yet.');
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.topRoutesTable.innerHTML = routes.map(route => `
    <tr data-search-row="true" data-search-text="${escapeAttribute(route.route)}">
      <td><strong>${escapeHtml(route.route.replace('-', ' -> '))}</strong></td>
      <td><span class="badge badge-blue">${formatNumber(route.count)}</span></td>
    </tr>
  `).join('');
}

/**
 * Renders up to 6 recent bookings into the dashboard recent bookings table,
 * showing ref, passenger, route, date, cabin class, status, and price.
 * @param {Object[]} bookings - Array of booking objects to display
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderRecentBookings(bookings) {
  if (!elements.recentBookingsTable) return;

  if (!bookings.length) {
    elements.recentBookingsTable.innerHTML = buildEmptyRow(7, 'No recent bookings to display.');
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.recentBookingsTable.innerHTML = bookings.map(booking => `
    <tr data-search-row="true" data-search-text="${escapeAttribute(buildBookingSearchText(booking))}">
      <td><strong>${escapeHtml(booking.bookingRef || '-')}</strong></td>
      <td>${escapeHtml(booking.userName || '-')}</td>
      <td>${escapeHtml(`${booking.from} -> ${booking.to}`)}</td>
      <td>${escapeHtml(booking.date || '-')}</td>
      <td><span class="badge ${cabinBadgeClass(booking.cabinClass)}">${escapeHtml(capitalise(booking.cabinClass || 'economy'))}</span></td>
      <td><span class="badge ${statusBadgeClass(booking.status)}">${escapeHtml(formatStatus(booking.status))}</span></td>
      <td><strong>${formatCurrency(booking.totalPrice)}</strong></td>
    </tr>
  `).join('');
}

/**
 * Renders the operations pulse panel with key operational metrics such as
 * delayed/cancelled bookings, registered pilots, and inactive routes.
 * Each metric is colour-coded with a tone class (warning, danger, or neutral).
 * @param {Object} stats - Stats object from the admin stats API
 * @param {Object} routeSummary - Route summary object with inactiveRoutes count
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderOperationsPulse(stats, routeSummary) {
  if (!elements.operationsPulse) return;

  const metrics = [
    { label: 'Delayed bookings', value: formatNumber(stats.delayedBookings), tone: 'warning' },
    { label: 'Cancelled bookings', value: formatNumber(stats.cancelledBookings), tone: 'danger' },
    { label: 'Registered pilots', value: formatNumber(stats.totalUsers), tone: 'neutral' },
    { label: 'Inactive routes', value: formatNumber(routeSummary.inactiveRoutes), tone: 'neutral' }
  ];

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.operationsPulse.innerHTML = metrics.map(metric => `
    <div class="metric-row">
      <span>${escapeHtml(metric.label)}</span>
      <strong class="metric-value metric-${metric.tone}">${escapeHtml(metric.value)}</strong>
    </div>
  `).join('');
}

/**
 * Renders the hub allocation panel with proportional bar charts showing how many
 * routes and active aircraft are assigned to each hub. Uses all distinct hubs found
 * across both routes and fleet records.
 * @param {Object[]} routes - Array of route objects with hubAirport field
 * @param {Object[]} fleet - Array of aircraft objects with hub and status fields
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderHubAllocation(routes, fleet) {
  if (!elements.hubAllocation) return;

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const airportsByCode = Object.fromEntries((state.lookups.airports || []).map(airport => [airport.icao, airport]));
  const hubs = Array.from(new Set([
    /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ ...routes.map(route => route.hubAirport),
    /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ ...fleet.map(aircraft => aircraft.hub)
  ])).filter(Boolean);

  if (!hubs.length) {
    elements.hubAllocation.innerHTML = '<p class="panel-copy">No hub allocation data yet.</p>';
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const maxRoutes = Math.max(...hubs.map(hub => routes.filter(route => route.hubAirport === hub).length), 1);

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.hubAllocation.innerHTML = hubs.map(hub => {
    /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const hubRoutes = routes.filter(route => route.hubAirport === hub).length;
    /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const hubFleet = fleet.filter(aircraft => aircraft.hub === hub && aircraft.status === 'active').length;
    const airport = airportsByCode[hub];
    const fill = Math.max(10, Math.round((hubRoutes / maxRoutes) * 100));

    return `
      <div class="allocation-row">
        <div class="allocation-head">
          <strong>${escapeHtml(airport?.city || hub)}</strong>
          <span>${escapeHtml(`${hubFleet} aircraft • ${hubRoutes} routes`)}</span>
        </div>
        <div class="allocation-bar">
          <div class="allocation-bar-fill" style="width:${fill}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Loads all routes with schedules from the API, stores them in state, renders
 * the route summary counters and table, and selects the appropriate route in the
 * form (preserving the current selection if requested, falling back to the first route).
 * @param {Object} [options={}] - Options object
 * @param {boolean} [options.preserveSelection=false] - If true, re-selects the previously selected route
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function loadRoutesWorkspace(options = {}) {
  try {
    const response = await fetchAdmin('/api/admin/routes');
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Could not load routes.');
    }

    state.routes = payload.routes;
    state.routeSummary = payload.summary;

    renderRouteSummary(payload.summary);
    renderRoutesTable();

    if (options.preserveSelection && state.selectedRouteId) {
      /* Purpose: checks each candidate until the surrounding lookup finds its match. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const selectedRoute = state.routes.find(route => route.id === state.selectedRouteId);
      if (selectedRoute) {
        renderRouteForm(selectedRoute);
        return;
      }
    }

    if (state.selectedRouteId) {
      /* Purpose: checks each candidate until the surrounding lookup finds its match. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const selectedRoute = state.routes.find(route => route.id === state.selectedRouteId);
      if (selectedRoute) {
        renderRouteForm(selectedRoute);
        return;
      }
    }

    if (state.routes.length) {
      selectRoute(state.routes[0].id);
      return;
    }

    startNewRoute();
  } catch (error) {
    showToast(error.message || 'Could not load routes.', 'error');
  }
}

/**
 * Renders the route summary counter widgets (total, active, assigned, hubs)
 * by setting the text content of the corresponding elements.
 * @param {Object} summary - Route summary object from the API
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderRouteSummary(summary) {
  setText(elements.routeSummaryTotal, formatNumber(summary.totalRoutes));
  setText(elements.routeSummaryActive, formatNumber(summary.activeRoutes));
  setText(elements.routeSummaryAssigned, formatNumber(summary.routesWithAircraft));
  setText(elements.routeSummaryHubs, formatNumber(summary.hubs));
}

/**
 * Renders the routes table, applying the current search query and status filter.
 * Highlights the currently selected route row. Shows an empty state if no routes
 * match. Also re-applies the global search after rendering.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderRoutesTable() {
  if (!elements.routesTable) return;

  const query = String(elements.routeSearchInput?.value || '').trim().toLowerCase();
  const status = elements.routeStatusFilter?.value || 'all';

  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const routes = state.routes.filter(route => {
    const matchesStatus = status === 'all' || route.status === status;
    if (!matchesStatus) return false;

    if (!query) return true;

    return buildRouteSearchText(route).includes(query);
  });

  if (!routes.length) {
    elements.routesTable.innerHTML = buildEmptyRow(5, 'No routes match the current filters.');
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.routesTable.innerHTML = routes.map(route => {
    const selected = route.id === state.selectedRouteId ? ' class="is-selected"' : '';
    const scheduleLabel = route.schedules.length
      ? route.schedules
        /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ .map(schedule => `${escapeHtml(schedule.flightNumber)} @ ${escapeHtml(shortTime(schedule.departureTime))}`)
        .join('<br />')
      : 'No schedule';

    return `
      <tr data-route-id="${route.id}"${selected} data-search-row="true" data-search-text="${escapeAttribute(buildRouteSearchText(route))}">
        <td><span class="badge badge-blue">${escapeHtml(route.hubAirport)}</span></td>
        <td>
          <strong>${escapeHtml(route.fromAirport)} → ${escapeHtml(route.toAirport)}</strong>
          <div class="row-subtext">${escapeHtml(route.fromAirportDetails?.city || route.fromAirport)} to ${escapeHtml(route.toAirportDetails?.city || route.toAirport)}</div>
        </td>
        <td>
          ${route.aircraft
            ? `<strong>${escapeHtml(route.aircraft.registration)}</strong><div class="row-subtext">${escapeHtml(route.aircraft.type)}</div>`
            : '<span class="badge badge-warning">Unassigned</span>'}
        </td>
        <td>${scheduleLabel}</td>
        <td><span class="badge ${route.status === 'active' ? 'badge-success' : 'badge-warning'}">${escapeHtml(capitalise(route.status))}</span></td>
      </tr>
    `;
  }).join('');

  applyGlobalSearch(elements.globalSearchInput?.value || '');
}

/**
 * Sets the selected route by ID, updates state, re-renders the route form with
 * the selected route's data, and refreshes the routes table to highlight the row.
 * @param {number|string} routeId - The ID of the route to select
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function selectRoute(routeId) {
  state.selectedRouteId = Number(routeId);
  /* Purpose: checks each candidate until the surrounding lookup finds its match. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const route = state.routes.find(item => item.id === state.selectedRouteId);
  renderRouteForm(route || null);
  renderRoutesTable();
}

/**
 * Clears the selected route ID and resets the route form to its "create new" state,
 * then re-renders the routes table to remove any row selection highlight.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function startNewRoute() {
  state.selectedRouteId = null;
  renderRouteForm(null);
  renderRoutesTable();
}

/**
 * Renders the route edit/create form, populating all fields from the given route
 * object if provided. Sets form title, subtitle, save button label, schedule list,
 * and the distance/duration meta line. Renders a default single schedule slot
 * when creating a new route.
 * @param {Object|null} route - Route object to populate the form with, or null for new
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderRouteForm(route) {
  populateRouteSelects(route);

  if (elements.routeId) elements.routeId.value = route?.id || '';
  if (elements.routeStatus) elements.routeStatus.value = route?.status || 'active';

  if (elements.routeFormTitle) {
    elements.routeFormTitle.textContent = route ? `Edit Route #${route.id}` : 'Create Route';
  }

  if (elements.routeFormSubtitle) {
    elements.routeFormSubtitle.textContent = route
      ? 'Update airports, schedules, and aircraft assignment for this sector.'
      : 'Create a new sector and assign departure banks.';
  }

  if (elements.saveRouteButton) {
    elements.saveRouteButton.textContent = route ? 'Save Changes' : 'Create Route';
  }

  const schedules = route?.schedules?.length
    /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ ? route.schedules.map(schedule => ({
      flightNumber: schedule.flightNumber,
      slotCode: schedule.slotCode,
      departureTime: shortTime(schedule.departureTime),
      active: schedule.active
    }))
    : [buildDefaultSchedule(1)];

  renderScheduleList(schedules);

  const meta = route
    ? `${route.distanceKm.toLocaleString()} km • ${formatDuration(route.durationMinutes)} • ${route.aircraft ? route.aircraft.registration : 'No aircraft assigned'}`
    : 'New routes will use database-calculated distance and duration.';
  setText(elements.routeFormMeta, meta);
}

/**
 * Builds a default schedule object for a new route slot, cycling through three
 * preset departure times (07:00, 12:00, 18:00) based on the given index.
 * @param {number} index - 1-based slot index (used to pick the departure time default)
 * @returns {Object} Default schedule with flightNumber, slotCode, departureTime, active
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildDefaultSchedule(index) {
  const defaults = ['07:00', '12:00', '18:00'];
  return {
    flightNumber: '',
    slotCode: `slot-${index}`,
    departureTime: defaults[index - 1] || '09:00',
    active: true
  };
}

/**
 * Renders the schedule card list inside the route form, creating one card per
 * schedule with flight number, slot code, departure time, active toggle, and
 * a remove button (disabled when only one schedule remains).
 * @param {Object[]} schedules - Array of schedule objects to render
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderScheduleList(schedules) {
  if (!elements.routeSchedules) return;

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.routeSchedules.innerHTML = schedules.map((schedule, index) => `
    <div class="schedule-card" data-schedule-index="${index}">
      <label class="form-field">
        <span>Flight Number</span>
        <input class="admin-input" data-schedule-field="flightNumber" type="text" value="${escapeAttribute(schedule.flightNumber || '')}" placeholder="AFV201" required />
      </label>
      <label class="form-field">
        <span>Slot Code</span>
        <input class="admin-input" data-schedule-field="slotCode" type="text" value="${escapeAttribute(schedule.slotCode || `slot-${index + 1}`)}" placeholder="morning" required />
      </label>
      <label class="form-field">
        <span>Departure</span>
        <input class="admin-input" data-schedule-field="departureTime" type="time" value="${escapeAttribute(toTimeInputValue(schedule.departureTime || '07:00'))}" required />
      </label>
      <label class="schedule-toggle">
        <input data-schedule-field="active" type="checkbox" ${schedule.active ? 'checked' : ''} />
        <span>Active</span>
      </label>
      <button type="button" class="btn btn-outline-red btn-sm schedule-remove-button" data-remove-schedule="${index}" ${schedules.length === 1 ? 'disabled' : ''}>Remove</button>
    </div>
  `).join('');
}

/**
 * Reads the current schedule cards from the form, appends a new default schedule,
 * and re-renders the schedule list with the additional slot.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function handleAddSchedule() {
  const schedules = readSchedulesFromForm();
  schedules.push(buildDefaultSchedule(schedules.length + 1));
  renderScheduleList(schedules);
}

/**
 * Handles click events on the schedule list container. When a remove button is
 * clicked, removes the corresponding schedule from the list and re-renders.
 * Ensures at least one schedule card always remains.
 * @param {MouseEvent} event - Click event from the schedule list container
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function handleScheduleListClick(event) {
  const button = event.target.closest('[data-remove-schedule]');
  if (!button) return;

  const schedules = readSchedulesFromForm();
  const index = Number(button.dataset.removeSchedule);
  schedules.splice(index, 1);
  renderScheduleList(schedules.length ? schedules : [buildDefaultSchedule(1)]);
}

/**
 * Reads all schedule card inputs from the DOM and returns them as an array of
 * schedule objects with flightNumber, slotCode, departureTime, and active fields.
 * @returns {Object[]} Array of schedule objects from the current form state
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function readSchedulesFromForm() {
  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ return Array.from(elements.routeSchedules?.querySelectorAll('.schedule-card') || []).map((card, index) => ({
    flightNumber: card.querySelector('[data-schedule-field="flightNumber"]')?.value?.trim() || '',
    slotCode: card.querySelector('[data-schedule-field="slotCode"]')?.value?.trim() || `slot-${index + 1}`,
    departureTime: card.querySelector('[data-schedule-field="departureTime"]')?.value || '07:00',
    active: Boolean(card.querySelector('[data-schedule-field="active"]')?.checked)
  }));
}

/**
 * Reads all route form field values and assembles them into a payload object
 * suitable for the POST /api/admin/routes or PUT /api/admin/routes/:id endpoints.
 * @returns {Object} Route payload with fromAirport, toAirport, hubAirport, aircraftId, status, schedules
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildRoutePayloadFromForm() {
  return {
    fromAirport: elements.routeFromAirport?.value,
    toAirport: elements.routeToAirport?.value,
    hubAirport: elements.routeHubAirport?.value,
    aircraftId: elements.routeAircraft?.value ? Number(elements.routeAircraft.value) : null,
    status: elements.routeStatus?.value || 'active',
    schedules: readSchedulesFromForm()
  };
}

/**
 * Handles the route form submit event. Determines whether to create or update
 * based on the hidden routeId field, submits to the appropriate API endpoint,
 * and on success reloads lookups, the routes workspace, and the dashboard.
 * @param {SubmitEvent} event - Form submit event; preventDefault is called
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function handleRouteSubmit(event) {
  event.preventDefault();

  try {
    const routeId = Number(elements.routeId?.value || 0);
    const payload = buildRoutePayloadFromForm();

    const response = await fetchAdmin(routeId ? `/api/admin/routes/${routeId}` : '/api/admin/routes', {
      method: routeId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });

    const route = await response.json();
    if (!response.ok) {
      throw new Error(route.error || 'Could not save route.');
    }

    state.selectedRouteId = route.id;
    await loadLookups(true);
    await Promise.all([
      loadRoutesWorkspace({ preserveSelection: true }),
      loadDashboard(),
      loadFleetTable()
    ]);
    showToast(routeId ? 'Route updated successfully.' : 'Route created successfully.', 'success');
  } catch (error) {
    showToast(error.message || 'Could not save route.', 'error');
  }
}

/**
 * Handles click events on the routes table. Selects the clicked route by reading
 * the data-route-id attribute from the closest table row.
 * @param {MouseEvent} event - Click event from the routes table
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function handleRoutesTableClick(event) {
  const row = event.target.closest('[data-route-id]');
  if (!row) return;
  selectRoute(row.dataset.routeId);
}

/**
 * Fetches the full fleet list from the API, stores it in state, and re-renders
 * the fleet table and hub allocation panel.
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function loadFleetTable() {
  try {
    const response = await fetch('/api/fleet');
    const fleet = await response.json();
    if (!response.ok) {
      throw new Error(fleet.error || 'Could not load fleet.');
    }

    state.fleet = fleet;
    renderFleetTable();
    renderHubAllocation(state.routes, fleet);
  } catch (error) {
    showToast(error.message || 'Could not load fleet.', 'error');
  }
}

/**
 * Renders the fleet management table with registration, type, hub, seat count,
 * assigned routes count, status badge, and an Edit button for each aircraft.
 * Shows an empty state row if the fleet is empty.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderFleetTable() {
  if (!elements.fleetTable) return;

  if (!state.fleet.length) {
    elements.fleetTable.innerHTML = buildEmptyRow(7, 'No aircraft found.');
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.fleetTable.innerHTML = state.fleet.map(aircraft => {
    /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const assignedRoutes = state.routes.filter(route => Number(route.aircraftId) === Number(aircraft.id)).length;
    const totalSeats = Number(aircraft.seats?.economy || 0) + Number(aircraft.seats?.business || 0) + Number(aircraft.seats?.first || 0);

    return `
      <tr data-search-row="true" data-search-text="${escapeAttribute(buildFleetSearchText(aircraft))}">
        <td><strong>${escapeHtml(aircraft.registration)}</strong></td>
        <td>
          ${escapeHtml(aircraft.type)}
          <div class="row-subtext">${escapeHtml(aircraft.category)}</div>
        </td>
        <td>${escapeHtml(`${aircraft.hub_name} (${aircraft.hub})`)}</td>
        <td>${formatNumber(totalSeats)}</td>
        <td>${formatNumber(assignedRoutes)}</td>
        <td><span class="badge ${aircraft.status === 'active' ? 'badge-success' : 'badge-warning'}">${escapeHtml(capitalise(aircraft.status))}</span></td>
        <td><button type="button" class="btn btn-outline-red btn-sm" data-edit-aircraft="${aircraft.id}">Edit</button></td>
      </tr>
    `;
  }).join('');

  applyGlobalSearch(elements.globalSearchInput?.value || '');
}

/**
 * Handles click events on the fleet table. Opens the aircraft edit modal for
 * the aircraft whose edit button was clicked, using the data-edit-aircraft attribute.
 * @param {MouseEvent} event - Click event from the fleet table
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function handleFleetTableClick(event) {
  const button = event.target.closest('[data-edit-aircraft]');
  if (!button) return;
  openAircraftModal(Number(button.dataset.editAircraft));
}

/**
 * Opens the aircraft modal for editing an existing aircraft or creating a new one.
 * Pre-populates all form fields from the fleet state when an ID is provided.
 * Resets the form and hides the retire button for new aircraft.
 * @param {number|null} [aircraftId=null] - ID of the aircraft to edit, or null for new
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function openAircraftModal(aircraftId = null) {
  populateAircraftHubSelect();
  elements.aircraftForm?.reset();

  if (aircraftId) {
    /* Purpose: checks each candidate until the surrounding lookup finds its match. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const aircraft = state.fleet.find(item => item.id === aircraftId);
    if (!aircraft) {
      showToast('Aircraft not found.', 'error');
      return;
    }

    elements.aircraftId.value = aircraft.id;
    elements.aircraftRegistration.value = aircraft.registration || '';
    elements.aircraftType.value = aircraft.type || '';
    elements.aircraftCategory.value = aircraft.category || 'Regional';
    populateAircraftHubSelect(aircraft.hub);
    elements.aircraftStatus.value = aircraft.status || 'active';
    elements.aircraftSeatsEconomy.value = aircraft.seats?.economy || 0;
    elements.aircraftSeatsBusiness.value = aircraft.seats?.business || 0;
    elements.aircraftSeatsFirst.value = aircraft.seats?.first || 0;
    elements.aircraftRangeKm.value = aircraft.range_km || 0;
    elements.aircraftCruiseSpeed.value = aircraft.cruise_speed_kmh || 0;
    elements.aircraftImage.value = aircraft.image || '';
    elements.aircraftDescription.value = aircraft.description || '';
    elements.aircraftModalTitle.textContent = `Edit ${aircraft.registration}`;
    elements.aircraftModalSubtitle.textContent = 'Update aircraft details and route planning data.';
    elements.retireAircraftButton.classList.remove('hidden');
  } else {
    elements.aircraftId.value = '';
    elements.aircraftModalTitle.textContent = 'Add Aircraft';
    elements.aircraftModalSubtitle.textContent = 'Create a new aircraft record for the fleet database.';
    elements.retireAircraftButton.classList.add('hidden');
  }

  elements.aircraftModal?.classList.add('open');
}

/**
 * Closes the aircraft modal by removing the 'open' CSS class.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function closeAircraftModal() {
  elements.aircraftModal?.classList.remove('open');
}

/**
 * Handles the aircraft form submit event. Validates the selected hub airport,
 * builds the aircraft payload, and submits to the fleet API (POST for new,
 * PUT for existing). Reloads lookups, fleet, routes, and dashboard on success.
 * @param {SubmitEvent} event - Form submit event; preventDefault is called
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function handleAircraftSubmit(event) {
  event.preventDefault();

  try {
    const aircraftId = Number(elements.aircraftId?.value || 0);
    /* Purpose: checks each candidate until the surrounding lookup finds its match. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const hubAirport = (state.lookups.airports || []).find(airport => airport.icao === elements.aircraftHub?.value);
    if (!hubAirport) {
      throw new Error('Please choose a valid hub airport.');
    }

    const payload = {
      registration: elements.aircraftRegistration?.value?.trim().toUpperCase(),
      type: elements.aircraftType?.value?.trim(),
      category: elements.aircraftCategory?.value,
      hub: hubAirport.icao,
      hub_name: hubAirport.city,
      seats: {
        economy: Number(elements.aircraftSeatsEconomy?.value || 0),
        business: Number(elements.aircraftSeatsBusiness?.value || 0),
        first: Number(elements.aircraftSeatsFirst?.value || 0)
      },
      range_km: Number(elements.aircraftRangeKm?.value || 0),
      cruise_speed_kmh: Number(elements.aircraftCruiseSpeed?.value || 0),
      status: elements.aircraftStatus?.value || 'active',
      image: elements.aircraftImage?.value?.trim() || null,
      description: elements.aircraftDescription?.value?.trim() || null
    };

    const response = await fetchAdmin(aircraftId ? `/api/fleet/${aircraftId}` : '/api/fleet', {
      method: aircraftId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });

    const aircraft = await response.json();
    if (!response.ok) {
      throw new Error(aircraft.error || 'Could not save aircraft.');
    }

    closeAircraftModal();
    await loadLookups(true);
    await Promise.all([
      loadFleetTable(),
      loadRoutesWorkspace({ preserveSelection: true }),
      loadDashboard()
    ]);
    showToast(aircraftId ? 'Aircraft updated successfully.' : 'Aircraft added successfully.', 'success');
  } catch (error) {
    showToast(error.message || 'Could not save aircraft.', 'error');
  }
}

/**
 * Prompts for confirmation and then retires (deletes) the aircraft currently
 * open in the modal via DELETE /api/fleet/:id. Reloads lookups, fleet, routes,
 * and dashboard on success.
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function handleRetireAircraft() {
  const aircraftId = Number(elements.aircraftId?.value || 0);
  if (!aircraftId) return;

  if (!window.confirm('Retire this aircraft from the active fleet?')) {
    return;
  }

  try {
    const response = await fetchAdmin(`/api/fleet/${aircraftId}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Could not retire aircraft.');
    }

    closeAircraftModal();
    await loadLookups(true);
    await Promise.all([
      loadFleetTable(),
      loadRoutesWorkspace({ preserveSelection: true }),
      loadDashboard()
    ]);
    showToast('Aircraft retired.', 'success');
  } catch (error) {
    showToast(error.message || 'Could not retire aircraft.', 'error');
  }
}

/**
 * Fetches all bookings from the admin API, stores them in state, and renders
 * the bookings management table.
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function loadBookings() {
  try {
    const response = await fetchAdmin('/api/admin/bookings');
    const bookings = await response.json();
    if (!response.ok) {
      throw new Error(bookings.error || 'Could not load bookings.');
    }

    state.bookings = bookings;
    renderBookingsTable();
  } catch (error) {
    showToast(error.message || 'Could not load bookings.', 'error');
  }
}

/**
 * Renders the full bookings table, filtered by the current booking search input.
 * Each row includes a status dropdown for inline status changes. Shows an empty
 * state row if no bookings match the filter.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderBookingsTable() {
  if (!elements.allBookingsTable) return;

  const query = String(elements.bookingSearchInput?.value || '').trim().toLowerCase();
  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const bookings = state.bookings.filter(booking => {
    if (!query) return true;
    return buildBookingSearchText(booking).includes(query);
  });

  if (!bookings.length) {
    elements.allBookingsTable.innerHTML = buildEmptyRow(10, 'No bookings match the current search.');
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.allBookingsTable.innerHTML = bookings.map(booking => `
    <tr data-search-row="true" data-search-text="${escapeAttribute(buildBookingSearchText(booking))}">
      <td><strong>${escapeHtml(booking.bookingRef || '-')}</strong></td>
      <td>${escapeHtml(booking.userName || '-')}</td>
      <td>${escapeHtml(booking.flightNumber || '-')}</td>
      <td>${escapeHtml(`${booking.from} -> ${booking.to}`)}</td>
      <td>${escapeHtml(booking.date || '-')}</td>
      <td>${escapeHtml(capitalise(booking.cabinClass || ''))}</td>
      <td>${formatNumber(booking.passengers || 1)}</td>
      <td><strong>${formatCurrency(booking.totalPrice)}</strong></td>
      <td><span class="badge ${statusBadgeClass(booking.status)}">${escapeHtml(formatStatus(booking.status))}</span></td>
      <td>
        <select class="admin-select booking-status-select" data-booking-ref="${booking.bookingRef}">
          ${buildStatusOptions(booking.status)}
        </select>
      </td>
    </tr>
  `).join('');

  applyGlobalSearch(elements.globalSearchInput?.value || '');
}

/**
 * Builds an HTML string of <option> elements for the booking status select dropdown,
 * pre-selecting the currently applied status.
 * @param {string} currentStatus - The booking's current status value
 * @returns {string} HTML string of <option> elements
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildStatusOptions(currentStatus) {
  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ return ['confirmed', 'on_time', 'delayed', 'cancelled'].map(status => `
    <option value="${status}"${status === currentStatus ? ' selected' : ''}>${escapeHtml(formatStatus(status))}</option>
  `).join('');
}

/**
 * Handles change events on the bookings table. When a status dropdown changes,
 * submits the new status to the API and reloads both the bookings table and dashboard.
 * @param {Event} event - Change event from the bookings table container
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function handleBookingStatusChange(event) {
  const select = event.target.closest('.booking-status-select');
  if (!select) return;

  try {
    const response = await fetchAdmin(`/api/admin/bookings/${select.dataset.bookingRef}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: select.value })
    });

    const booking = await response.json();
    if (!response.ok) {
      throw new Error(booking.error || 'Could not update booking status.');
    }

    await Promise.all([
      loadBookings(),
      loadDashboard()
    ]);
    showToast(`Booking ${booking.bookingRef} updated.`, 'success');
  } catch (error) {
    showToast(error.message || 'Could not update booking status.', 'error');
  }
}

/**
 * Fetches all users from the admin API, stores them in state, and renders
 * the users management table.
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function loadUsers() {
  try {
    const response = await fetchAdmin('/api/admin/users');
    const users = await response.json();
    if (!response.ok) {
      throw new Error(users.error || 'Could not load users.');
    }

    state.users = users;
    renderUsersTable();
  } catch (error) {
    showToast(error.message || 'Could not load users.', 'error');
  }
}

/**
 * Handles the user create form submit event. Validates that the current user
 * is the primary admin, submits the new user to the API, resets the form,
 * and reloads the users table on success.
 * @param {SubmitEvent} event - Form submit event; preventDefault is called
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function handleUserCreate(event) {
  event.preventDefault();

  if (!state.currentUser?.isPrimaryAdmin) {
    showToast('Only the main admin can create logins.', 'error');
    return;
  }

  try {
    const payload = {
      name: elements.userCreateName?.value?.trim(),
      email: elements.userCreateEmail?.value?.trim().toLowerCase(),
      password: elements.userCreatePassword?.value || '',
      role: elements.userCreateRole?.value || 'user',
      vatsimCid: elements.userCreateVatsimCid?.value?.trim() || null
    };

    const response = await fetchAdmin('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const user = await response.json();
    if (!response.ok) {
      throw new Error(user.error || 'Could not create login.');
    }

    elements.userCreateForm?.reset();
    if (elements.userCreateRole) {
      elements.userCreateRole.value = 'user';
    }
    await loadUsers();
    showToast(`${user.name} can now sign in with their new account.`, 'success');
  } catch (error) {
    showToast(error.message || 'Could not create login.', 'error');
  }
}

/**
 * Renders the users management table, filtered by the current user search input.
 * Each row shows ID, name, email, VATSIM CID, join date, creator, flight hours,
 * points, and an inline role dropdown. The primary admin and non-primary-admin
 * callers cannot change roles.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderUsersTable() {
  if (!elements.usersTable) return;

  const query = String(elements.userSearchInput?.value || '').trim().toLowerCase();
  /* Purpose: filters the current collection down to the items needed by the surrounding step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ const users = state.users.filter(user => {
    if (!query) return true;
    return buildUserSearchText(user).includes(query);
  });

  if (!users.length) {
    elements.usersTable.innerHTML = buildEmptyRow(9, 'No users match the current search.');
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.usersTable.innerHTML = users.map(user => `
    <tr data-search-row="true" data-search-text="${escapeAttribute(buildUserSearchText(user))}">
      <td>#${escapeHtml(String(user.id))}</td>
      <td><strong>${escapeHtml(user.name)}</strong></td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.vatsimCid || '-')}</td>
      <td>${escapeHtml(user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '-')}</td>
      <td>${escapeHtml(user.createdByName || (user.isPrimaryAdmin ? 'System seed' : '-'))}</td>
      <td>${formatNumber(user.flightHours || 0)}</td>
      <td>${formatNumber(user.points || 0)}</td>
      <td>
        <select class="admin-select user-role-select" data-user-id="${user.id}"${buildUserRoleDisabled(user)}>
          <option value="user"${user.role === 'user' ? ' selected' : ''}>User</option>
          <option value="admin"${user.role === 'admin' ? ' selected' : ''}>Admin</option>
        </select>
        ${user.isPrimaryAdmin ? '<div class="row-subtext">Main admin</div>' : ''}
      </td>
    </tr>
  `).join('');

  applyGlobalSearch(elements.globalSearchInput?.value || '');
}

/**
 * Handles change events on the users table. When a role dropdown changes,
 * verifies the current user is the primary admin, submits the new role to the API,
 * and reloads the users table.
 * @param {Event} event - Change event from the users table container
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function handleUserRoleChange(event) {
  const select = event.target.closest('.user-role-select');
  if (!select) return;

  if (!state.currentUser?.isPrimaryAdmin) {
    showToast('Only the main admin can change user roles.', 'error');
    await loadUsers();
    return;
  }

  try {
    const response = await fetchAdmin(`/api/admin/users/${select.dataset.userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: select.value })
    });

    const user = await response.json();
    if (!response.ok) {
      throw new Error(user.error || 'Could not update user role.');
    }

    await loadUsers();
    showToast(`${user.name}'s role updated to ${user.role}.`, 'success');
  } catch (error) {
    showToast(error.message || 'Could not update user role.', 'error');
  }
}

/**
 * Fetches the current list of online AFV pilots from the VATSIM API and renders
 * the VATSIM table. Optionally shows a success toast when called as a manual refresh.
 * @param {boolean} [showSuccessToast=false] - Whether to show a "refreshed" toast
 * @returns {Promise<void>}
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
async function loadVatsim(showSuccessToast = false) {
  try {
    const response = await fetch('/api/vatsim/online');
    const data = await response.json();
    const pilots = data.onlinePilots || [];
    state.vatsim = pilots;
    renderVatsimTable();

    if (showSuccessToast) {
      showToast('VATSIM data refreshed.', 'success');
    }
  } catch (error) {
    showToast(error.message || 'VATSIM data unavailable.', 'error');
  }
}

/**
 * Renders the VATSIM live pilots table with callsign, name, CID, aircraft type,
 * departure, destination, altitude, and groundspeed for each online pilot.
 * Shows an empty state row if no pilots are currently online.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function renderVatsimTable() {
  if (!elements.vatsimTable) return;

  if (!state.vatsim.length) {
    elements.vatsimTable.innerHTML = buildEmptyRow(8, 'No AFV pilots are online right now.');
    return;
  }

  /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ elements.vatsimTable.innerHTML = state.vatsim.map(pilot => `
    <tr data-search-row="true" data-search-text="${escapeAttribute(buildVatsimSearchText(pilot))}">
      <td><strong>${escapeHtml(pilot.callsign)}</strong></td>
      <td>${escapeHtml(pilot.name || '-')}</td>
      <td>${escapeHtml(String(pilot.cid || '-'))}</td>
      <td>${escapeHtml(pilot.aircraft || '-')}</td>
      <td>${escapeHtml(pilot.from || '-')}</td>
      <td>${escapeHtml(pilot.to || '-')}</td>
      <td>${escapeHtml(`${formatNumber(pilot.altitude || 0)} ft`)}</td>
      <td>${escapeHtml(`${formatNumber(pilot.groundspeed || 0)} kt`)}</td>
    </tr>
  `).join('');

  applyGlobalSearch(elements.globalSearchInput?.value || '');
}

/**
 * Applies the global search filter to all data-search-row elements in the active section.
 * Rows whose data-search-text does not include the normalised query are hidden with
 * the hidden-by-search CSS class.
 * @param {string} query - Raw search string from the global search input
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function applyGlobalSearch(query) {
  const activeSection = document.querySelector(`.admin-section[data-section="${state.activeSection}"]`);
  if (!activeSection) return;

  const normalizedQuery = String(query || '').trim().toLowerCase();
  /* Purpose: applies the surrounding side effect to each item in the current collection. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ activeSection.querySelectorAll('[data-search-row]').forEach(row => {
    const searchText = String(row.dataset.searchText || '').toLowerCase();
    row.classList.toggle('hidden-by-search', Boolean(normalizedQuery) && !searchText.includes(normalizedQuery));
  });
}

/**
 * Wraps the native fetch call with the admin JWT Authorization header and a
 * default Content-Type of application/json. Additional options (method, body,
 * headers) are merged in.
 * @param {string} url - API endpoint path to fetch
 * @param {Object} [options={}] - Optional fetch options to merge (method, body, headers)
 * @returns {Promise<Response>} The fetch Response promise
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function fetchAdmin(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

/**
 * Updates the "last updated" timestamp display with the current local date and time.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function stampLastUpdated() {
  const now = new Date();
  setText(elements.lastUpdated, `Last updated ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
}

/**
 * Sets the sidebar health indicator text to the given message.
 * @param {string} message - Status message to display in the sidebar health area
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function setSidebarHealth(message) {
  setText(elements.sidebarHealth, message);
}

/**
 * Clears the stored JWT token and user from localStorage, then redirects the
 * browser to the public home page.
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function logout() {
  localStorage.removeItem('afv_token');
  localStorage.removeItem('afv_user');
  window.location.href = 'index.php';
}

/**
 * Clears the stored JWT token and user from localStorage, shows a toast with
 * the given message, and redirects to the public home page after 1.2 seconds.
 * @param {string} message - Message to display in the toast before redirecting
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function redirectToPublicSite(message) {
  localStorage.removeItem('afv_token');
  localStorage.removeItem('afv_user');
  showToast(message, 'error');
  /* Purpose: runs delayed follow-up logic after the surrounding timeout expires. Connection: continues the admin dashboard boot, render, and interaction flow after a controlled delay. */ window.setTimeout(() => {
    window.location.href = 'index.php';
  }, 1200);
}

/**
 * Sets the textContent of a DOM element if it exists.
 * @param {HTMLElement|null} element - The element to update
 * @param {string} value - The text content to set
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function setText(element, value) {
  if (element) element.textContent = value;
}

/**
 * Builds a single-row empty-state HTML string for a table with the given
 * column span and message text.
 * @param {number} columns - Number of columns for the colspan attribute
 * @param {string} message - Message to display in the empty state cell
 * @returns {string} HTML string for the empty state table row
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildEmptyRow(columns, message) {
  return `<tr><td colspan="${columns}" class="empty-state">${escapeHtml(message)}</td></tr>`;
}

/**
 * Formats a number with locale-aware thousands separators.
 * Returns '0' for falsy or non-numeric values.
 * @param {number|string|null} value - The number to format
 * @returns {string} Formatted number string e.g. "1,234"
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

/**
 * Formats a number as a USD currency string with locale-aware thousands separators.
 * @param {number|string|null} value - The amount to format
 * @returns {string} Formatted currency string e.g. "$1,234"
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

/**
 * Formats a duration in minutes as an "Xh YYm" string (e.g. "2h 35m").
 * @param {number|string|null} minutes - Total duration in minutes
 * @returns {string} Formatted duration string
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function formatDuration(minutes) {
  const totalMinutes = Number(minutes || 0);
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return `${hours}h ${String(remainder).padStart(2, '0')}m`;
}

/**
 * Truncates a time string to the first 5 characters (HH:MM format).
 * Returns the original string unchanged if it is shorter than 5 characters.
 * @param {string|null} value - Time string to truncate
 * @returns {string} HH:MM portion of the time string
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function shortTime(value) {
  const stringValue = String(value || '');
  return stringValue.length >= 5 ? stringValue.slice(0, 5) : stringValue;
}

/**
 * Converts a time string to the HH:MM format expected by an <input type="time"> element.
 * Delegates to shortTime for the truncation.
 * @param {string|null} value - Time string to convert
 * @returns {string} HH:MM time string suitable for a time input value attribute
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function toTimeInputValue(value) {
  return shortTime(value);
}

/**
 * Capitalises the first character of a string and returns the rest unchanged.
 * Returns an empty string for falsy input.
 * @param {string} value - Input string
 * @returns {string} String with first letter capitalised
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function capitalise(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

/**
 * Converts a raw booking/route status string (e.g. "on_time") to a human-readable
 * label (e.g. "On Time") by splitting on underscores and capitalising each word.
 * @param {string} status - Raw status string
 * @returns {string} Display-friendly status label
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function formatStatus(status) {
  return String(status || '')
    .split('_')
    .map(capitalise)
    .join(' ');
}

/**
 * Returns the CSS badge class for a given booking or route status.
 * Cancelled → badge-error, delayed/inactive/maintenance/retired → badge-warning,
 * all others → badge-success.
 * @param {string} status - Status string from a booking or route
 * @returns {string} CSS class name for the badge element
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function statusBadgeClass(status) {
  if (status === 'cancelled') return 'badge-error';
  if (status === 'delayed' || status === 'inactive' || status === 'maintenance' || status === 'retired') return 'badge-warning';
  return 'badge-success';
}

/**
 * Returns the CSS badge class for a given cabin class.
 * first → badge-gold, business → badge-blue, economy/others → badge-neutral.
 * @param {string} cabinClass - Cabin class string: 'economy' | 'business' | 'first'
 * @returns {string} CSS class name for the badge element
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function cabinBadgeClass(cabinClass) {
  if (cabinClass === 'first') return 'badge-gold';
  if (cabinClass === 'business') return 'badge-blue';
  return 'badge-neutral';
}

/**
 * Builds a concatenated, lowercased search string for a route, including airports,
 * city names, aircraft registration/type, and all flight numbers.
 * @param {Object} route - Route object from the admin API
 * @returns {string} Lowercased searchable text for the route
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildRouteSearchText(route) {
  return [
    route.fromAirport,
    route.toAirport,
    route.hubAirport,
    route.fromAirportDetails?.city,
    route.toAirportDetails?.city,
    route.aircraft?.registration,
    route.aircraft?.type,
    /* Purpose: transforms each item in the current collection for the surrounding render or data step. Connection: feeds the surrounding collection pipeline inside the admin dashboard boot, render, and interaction flow. */ route.schedules.map(schedule => schedule.flightNumber).join(' ')
  ].join(' ').toLowerCase();
}

/**
 * Builds a concatenated, lowercased search string for an aircraft, including
 * registration, type, category, hub code, hub city, and status.
 * @param {Object} aircraft - Aircraft object from the fleet API
 * @returns {string} Lowercased searchable text for the aircraft
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildFleetSearchText(aircraft) {
  return [
    aircraft.registration,
    aircraft.type,
    aircraft.category,
    aircraft.hub,
    aircraft.hub_name,
    aircraft.status
  ].join(' ').toLowerCase();
}

/**
 * Builds a concatenated, lowercased search string for a booking, including
 * booking ref, passenger name, flight number, route, and passenger email.
 * @param {Object} booking - Booking object from the admin API
 * @returns {string} Lowercased searchable text for the booking
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildBookingSearchText(booking) {
  return [
    booking.bookingRef,
    booking.userName,
    booking.flightNumber,
    booking.from,
    booking.to,
    booking.passengerEmail
  ].join(' ').toLowerCase();
}

/**
 * Builds a concatenated, lowercased search string for a user, including name,
 * email, VATSIM CID, role, creator name, and a "main admin" label if applicable.
 * @param {Object} user - User object from the admin users API
 * @returns {string} Lowercased searchable text for the user
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildUserSearchText(user) {
  return [
    user.name,
    user.email,
    user.vatsimCid,
    user.role,
    user.createdByName,
    user.isPrimaryAdmin ? 'main admin' : ''
  ].join(' ').toLowerCase();
}

/**
 * Returns the HTML disabled attribute string for a user role select dropdown.
 * The select is disabled if the current admin is not the primary admin or if
 * the target user is the primary admin (whose role cannot be changed).
 * @param {Object} user - The user object whose role select is being rendered
 * @returns {string} ' disabled' or ''
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildUserRoleDisabled(user) {
  if (!state.currentUser?.isPrimaryAdmin || user.isPrimaryAdmin) {
    return ' disabled';
  }

  return '';
}

/**
 * Builds a concatenated, lowercased search string for a VATSIM pilot, including
 * callsign, name, aircraft type, departure, and destination ICAO.
 * @param {Object} pilot - Pilot object from the VATSIM online API
 * @returns {string} Lowercased searchable text for the pilot
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function buildVatsimSearchText(pilot) {
  return [
    pilot.callsign,
    pilot.name,
    pilot.aircraft,
    pilot.from,
    pilot.to
  ].join(' ').toLowerCase();
}

/**
 * Displays a toast notification in the admin panel with the given message and
 * type class. Clears any previous toast timeout and hides the toast after 3.2 seconds.
 * @param {string} message - Text to display in the toast
 * @param {string} [type=''] - Optional CSS class modifier e.g. 'error', 'success'
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function showToast(message, type = '') {
  if (!elements.toast) return;

  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type}`.trim();
  window.clearTimeout(showToast.timeoutId);
  /* Purpose: runs delayed follow-up logic after the surrounding timeout expires. Connection: continues the admin dashboard boot, render, and interaction flow after a controlled delay. */ showToast.timeoutId = window.setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3200);
}

/**
 * Escapes a value for safe insertion into HTML by replacing &, <, >, ", and '
 * with their HTML entity equivalents. Prevents XSS in rendered table cells.
 * @param {*} value - Value to escape (coerced to string)
 * @returns {string} HTML-safe string
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Escapes a value for safe use in an HTML attribute value. Delegates to escapeHtml.
 * @param {*} value - Value to escape
 * @returns {string} HTML attribute-safe string
 */
// Connection: part of the admin back-office boot, state, render, and event flow for this page.
function escapeAttribute(value) {
  return escapeHtml(value);
}

// ── Site Metrics ──────────────────────────────────────────────────────────────

const _mCharts = {};

function _killChart(id) {
  if (_mCharts[id]) { _mCharts[id].destroy(); delete _mCharts[id]; }
}

function _mkChart(id, config) {
  _killChart(id);
  const canvas = document.getElementById(id);
  if (!canvas || typeof Chart === 'undefined') return;
  _mCharts[id] = new Chart(canvas, config);
}

async function loadMetrics() {
  try {
    const res = await fetchAdmin('/api/admin/metrics');
    if (!res.ok) throw new Error();
    const m = await res.json();
    _renderMetricsKPIs(m.essentialMetrics);
    _renderGrowthChart(m.userTimeline, m.bookingTimeline);
    _renderCabinChart(m.cabinDistribution);
    _renderRoutesChart(m.topRoutes);
    _renderRevenueChart(m.revenueByClass, m.avgPriceByClass);
    _renderHistogramChart(m.priceHistogram);
    _renderScatterChart(m.distancePrice);
    _renderStatsSummary(m.priceStats);
    _renderHeatmap(m.heatmap);
    _renderBookingLifecycle(m.bookingLifecycle);
    _renderNationalityChart(m.nationalityTop10);
  } catch {
    showToast('Could not load site metrics.', 'error');
  }
}

function _renderMetricsKPIs(em) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const fmtUSD = v => v != null ? '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '-';
  set('mStatUpcoming',   em?.upcomingBookings ?? '-');
  set('mStatActive',     em?.activeUsers30d   ?? '-');
  set('mStatConversion', em?.conversionRate   != null ? em.conversionRate + '%' : '-');
  set('mStatAvgPrice',   fmtUSD(em?.avgTicketPrice));
}

const _C = {
  red:        '#cc1f36',
  redAlpha:   'rgba(204,31,54,0.12)',
  blue:       '#5bb3e4',
  blueAlpha:  'rgba(91,179,228,0.12)',
  green:      '#10b981',
  orange:     '#f59e0b',
  purple:     '#8b5cf6',
};

const _baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { font: { size: 12 }, boxWidth: 12 } } },
};

function _renderGrowthChart(userTimeline, bookingTimeline) {
  const months = [...new Set([...(userTimeline||[]).map(r=>r.month), ...(bookingTimeline||[]).map(r=>r.month)])].sort();
  const uMap = Object.fromEntries((userTimeline||[]).map(r=>[r.month,r.count]));
  const bMap = Object.fromEntries((bookingTimeline||[]).map(r=>[r.month,r.count]));
  _mkChart('metricsGrowthChart', {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Bookings', data: months.map(m=>bMap[m]||0), borderColor: _C.red,  backgroundColor: _C.redAlpha,  tension: 0.4, fill: true, pointRadius: 4 },
        { label: 'New Users', data: months.map(m=>uMap[m]||0), borderColor: _C.blue, backgroundColor: _C.blueAlpha, tension: 0.4, fill: true, pointRadius: 4 },
      ]
    },
    options: { ..._baseOpts, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

function _renderCabinChart(dist) {
  _mkChart('metricsCabinChart', {
    type: 'doughnut',
    data: {
      labels: ['Economy', 'Business', 'First'],
      datasets: [{ data: [dist?.economy||0, dist?.business||0, dist?.first||0],
        backgroundColor: [_C.red, _C.blue, _C.green], borderWidth: 2, borderColor: '#fff' }]
    },
    options: { ..._baseOpts, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } } }
  });
}

function _renderRoutesChart(routes) {
  if (!routes?.length) return;
  _mkChart('metricsRoutesChart', {
    type: 'bar',
    data: {
      labels: routes.map(r=>r.route),
      datasets: [{ label: 'Bookings', data: routes.map(r=>r.count),
        backgroundColor: routes.map((_,i) => i===0 ? _C.red : `rgba(204,31,54,${Math.max(0.25, 0.6-i*0.06).toFixed(2)})`),
        borderRadius: 6, borderSkipped: false }]
    },
    options: { ..._baseOpts, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } }
  });
}

function _renderRevenueChart(revenue, avgPrice) {
  const labels  = ['Economy', 'Business', 'First'];
  const keys    = ['economy', 'business', 'first'];
  const colors  = [_C.red, _C.blue, _C.green];
  const totals  = keys.map(k => revenue?.[k] || 0);
  const avgs    = keys.map(k => avgPrice?.[k] || 0);
  _mkChart('metricsRevenueChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Virtual Revenue (USD)', data: totals,
        backgroundColor: colors, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      ..._baseOpts,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => `Avg per booking: $${Number(avgs[ctx.dataIndex]).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: v => '$' + Number(v).toLocaleString() } }
      }
    }
  });
}

function _renderHistogramChart(bins) {
  if (!bins?.length) return;
  _mkChart('metricsHistogramChart', {
    type: 'bar',
    data: {
      labels: bins.map(b=>b.label),
      datasets: [{ label: 'Bookings', data: bins.map(b=>b.count),
        backgroundColor: _C.red, borderRadius: 6, borderSkipped: false }]
    },
    options: { ..._baseOpts, plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
  });
}

function _renderScatterChart(points) {
  _mkChart('metricsScatterChart', {
    type: 'scatter',
    data: {
      datasets: [{ label: 'Booking', data: points || [],
        backgroundColor: 'rgba(204,31,54,0.45)', pointRadius: 5, pointHoverRadius: 7 }]
    },
    options: { ..._baseOpts,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Distance (km)', font: { size: 11 } } },
        y: { title: { display: true, text: 'Price (USD)', font: { size: 11 } }, beginAtZero: true }
      }
    }
  });
}

function _renderStatsSummary(ps) {
  const grid   = document.getElementById('metricsStatsGrid');
  const ciNote = document.getElementById('metricsCiNote');
  if (!ps || ps.count === 0) {
    if (grid)   grid.innerHTML = '<p class="empty-state">No booking data available for statistical analysis.</p>';
    if (ciNote) ciNote.style.display = 'none';
    return;
  }
  const fmt = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const boxes = [
    { label: 'Mean',           value: fmt(ps.mean),     sub: 'Average booking price' },
    { label: 'Median',         value: fmt(ps.median),   sub: '50th percentile' },
    { label: 'Mode',           value: fmt(ps.mode),     sub: 'Most common price (±$100 bin)' },
    { label: 'Std. Deviation', value: fmt(ps.stddev),   sub: 'Spread around the mean' },
    { label: 'Variance',       value: fmt(ps.variance), sub: 'Squared deviation' },
    { label: 'P10',            value: fmt(ps.p10),      sub: 'Bottom 10% pay less than this' },
    { label: 'P90',            value: fmt(ps.p90),      sub: 'Top 10% pay more than this' },
    { label: 'Sample Size',    value: ps.count.toLocaleString(), sub: 'Non-cancelled bookings' },
  ];
  if (grid) grid.innerHTML = boxes.map(b => `
    <div class="stat-box">
      <div class="stat-box-label">${escapeHtml(b.label)}</div>
      <div class="stat-box-value">${escapeHtml(b.value)}</div>
      <div class="stat-box-sub">${escapeHtml(b.sub)}</div>
    </div>`).join('');
  if (ciNote) {
    ciNote.style.display = '';
    ciNote.innerHTML = `<strong>95% Confidence Interval on Mean Price:</strong> With ${ps.count} observations and σ = ${fmt(ps.stddev)}, the true mean price lies between <strong>${escapeHtml(fmt(ps.ci95Lower))}</strong> and <strong>${escapeHtml(fmt(ps.ci95Upper))}</strong> (CI = mean ± 1.96 × σ/√n). We are 95% confident the population mean falls within this range.`;
  }
}

function _renderHeatmap(heatmap) {
  const el = document.getElementById('metricsHeatmap');
  if (!el) return;
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const cabins  = ['economy','business','first'];
  const cLabels = { economy:'Economy', business:'Business', first:'First' };
  const cRgb    = { economy:'204,31,54', business:'91,179,228', first:'16,185,129' };
  let max = 1;
  for (let d = 1; d <= 7; d++) for (const c of cabins) max = Math.max(max, heatmap?.[d]?.[c] || 0);
  let html = '<table class="heatmap-table"><thead><tr><th>Day</th>';
  for (const c of cabins) html += `<th>${cLabels[c]}</th>`;
  html += '</tr></thead><tbody>';
  for (let d = 1; d <= 7; d++) {
    html += `<tr><td style="padding:6px 12px;font-family:var(--font-heading);font-size:0.8rem;font-weight:700;color:var(--gray-700)">${days[d-1]}</td>`;
    for (const c of cabins) {
      const v     = heatmap?.[d]?.[c] || 0;
      const alpha = (0.12 + (v / max) * 0.88).toFixed(2);
      html += `<td style="padding:4px"><div class="heatmap-cell" style="background:rgba(${cRgb[c]},${alpha})">${v}</div></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

function _renderBookingLifecycle(lc) {
  const el = document.getElementById('metricsFunnel');
  if (!el) return;
  const base  = lc?.total || 1;
  const steps = [
    { label: 'All Reservations',    value: lc?.total      || 0, sub: 'ever created' },
    { label: 'Not Cancelled',       value: lc?.active     || 0, sub: 'retained' },
    { label: 'Confirmed / On-time', value: lc?.goodStatus || 0, sub: 'healthy status' },
    { label: 'Completed On-time',   value: lc?.onTime     || 0, sub: 'successfully flown' },
  ];
  el.innerHTML = steps.map(s => {
    const pct = ((s.value / base) * 100).toFixed(1);
    const w   = Math.max(10, parseFloat(pct));
    return `<div class="funnel-step">
      <div class="funnel-bar-outer">
        <div class="funnel-bar-fill" style="width:${w}%">
          <span class="funnel-bar-label">${escapeHtml(s.label)}</span>
        </div>
      </div>
      <div class="funnel-step-meta">
        <div class="funnel-step-count">${s.value.toLocaleString()}</div>
        <div class="funnel-step-pct">${pct}% — ${escapeHtml(s.sub)}</div>
      </div>
    </div>`;
  }).join('');
}

function _renderNationalityChart(data) {
  if (!data?.length) return;
  _mkChart('metricsNationalityChart', {
    type: 'bar',
    data: {
      labels: data.map(d=>d.label),
      datasets: [{ label: 'Passengers', data: data.map(d=>d.count),
        backgroundColor: data.map((_,i) => i % 2 === 0 ? _C.red : _C.blue),
        borderRadius: 6, borderSkipped: false }]
    },
    options: { ..._baseOpts, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } }
  });
}
