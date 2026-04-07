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

function bindEvents() {
  document.querySelectorAll('.admin-side-link').forEach(button => {
    button.addEventListener('click', () => showSection(button.dataset.section));
  });

  elements.logoutButton?.addEventListener('click', logout);
  elements.refreshDashboardButton?.addEventListener('click', () => loadDashboard(true));
  elements.refreshVatsimButton?.addEventListener('click', () => loadVatsim(true));
  elements.routeNewButton?.addEventListener('click', startNewRoute);
  elements.resetRouteFormButton?.addEventListener('click', startNewRoute);
  elements.addScheduleButton?.addEventListener('click', handleAddSchedule);
  elements.routeForm?.addEventListener('submit', handleRouteSubmit);
  elements.routeSearchInput?.addEventListener('input', renderRoutesTable);
  elements.routeStatusFilter?.addEventListener('change', renderRoutesTable);
  elements.routesTable?.addEventListener('click', handleRoutesTableClick);
  elements.addAircraftButton?.addEventListener('click', () => openAircraftModal());
  elements.closeAircraftModalButton?.addEventListener('click', closeAircraftModal);
  elements.cancelAircraftButton?.addEventListener('click', closeAircraftModal);
  elements.aircraftModal?.addEventListener('click', event => {
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
  elements.globalSearchInput?.addEventListener('input', () => applyGlobalSearch(elements.globalSearchInput.value));
  elements.routeSchedules?.addEventListener('click', handleScheduleListClick);
}

function setAdminIdentity(user) {
  const initials = String(user.name || 'AF')
    .split(' ')
    .map(part => part[0])
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
    elements.userCreateForm.querySelectorAll('input, select, button').forEach(field => {
      field.disabled = disabled;
    });
  }
}

function showSection(sectionName) {
  state.activeSection = sectionName;

  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.toggle('hidden', section.dataset.section !== sectionName);
  });

  document.querySelectorAll('.admin-side-link').forEach(button => {
    button.classList.toggle('active', button.dataset.section === sectionName);
  });

  if (sectionName === 'dashboard') loadDashboard();
  if (sectionName === 'routes') loadRoutesWorkspace();
  if (sectionName === 'fleet') loadFleetTable();
  if (sectionName === 'bookings') loadBookings();
  if (sectionName === 'users') loadUsers();
  if (sectionName === 'vatsim') loadVatsim();

  applyGlobalSearch(elements.globalSearchInput?.value || '');
}

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

function populateRouteSelects(route = null) {
  const airports = state.lookups.airports || [];
  const hubAirports = airports.filter(airport => airport.hub);
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

function populateAircraftHubSelect(selectedHub = null) {
  const hubAirports = (state.lookups.airports || []).filter(airport => airport.hub);
  if (!elements.aircraftHub) return;

  elements.aircraftHub.innerHTML = buildAirportOptions(hubAirports, selectedHub, 'Select hub');
}

function buildAirportOptions(airports, selectedValue, placeholder) {
  const options = [`<option value="">${placeholder}</option>`];

  airports.forEach(airport => {
    const label = `${airport.city} (${airport.icao})${airport.hub ? ' • Hub' : ''}`;
    const selected = airport.icao === selectedValue ? ' selected' : '';
    options.push(`<option value="${airport.icao}"${selected}>${escapeHtml(label)}</option>`);
  });

  return options.join('');
}

function buildAircraftOptions(aircraftList, selectedId = null) {
  const options = ['<option value="">Unassigned / TBD</option>'];

  aircraftList.forEach(aircraft => {
    const selected = Number(selectedId) === Number(aircraft.id) ? ' selected' : '';
    const label = `${aircraft.registration} • ${aircraft.type} • ${aircraft.status}`;
    options.push(`<option value="${aircraft.id}"${selected}>${escapeHtml(label)}</option>`);
  });

  return options.join('');
}

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

function renderBookingsChart(bookings) {
  if (!elements.bookingsChart) return;

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthCounts = Array(12).fill(0);

  bookings.forEach(booking => {
    const date = new Date(booking.createdAt);
    if (!Number.isNaN(date.getTime())) {
      monthCounts[date.getMonth()] += 1;
    }
  });

  const maxValue = Math.max(...monthCounts, 1);
  elements.bookingsChart.innerHTML = monthCounts.map((count, index) => `
    <div class="chart-column">
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="height:${Math.max(8, Math.round((count / maxValue) * 100))}%"></div>
      </div>
      <span class="chart-bar-value">${count}</span>
      <span class="chart-bar-label">${monthLabels[index]}</span>
    </div>
  `).join('');
}

function renderTopRoutes(routes) {
  if (!elements.topRoutesTable) return;

  if (!routes.length) {
    elements.topRoutesTable.innerHTML = buildEmptyRow(2, 'No route demand data yet.');
    return;
  }

  elements.topRoutesTable.innerHTML = routes.map(route => `
    <tr data-search-row="true" data-search-text="${escapeAttribute(route.route)}">
      <td><strong>${escapeHtml(route.route.replace('-', ' -> '))}</strong></td>
      <td><span class="badge badge-blue">${formatNumber(route.count)}</span></td>
    </tr>
  `).join('');
}

function renderRecentBookings(bookings) {
  if (!elements.recentBookingsTable) return;

  if (!bookings.length) {
    elements.recentBookingsTable.innerHTML = buildEmptyRow(7, 'No recent bookings to display.');
    return;
  }

  elements.recentBookingsTable.innerHTML = bookings.map(booking => `
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

function renderOperationsPulse(stats, routeSummary) {
  if (!elements.operationsPulse) return;

  const metrics = [
    { label: 'Delayed bookings', value: formatNumber(stats.delayedBookings), tone: 'warning' },
    { label: 'Cancelled bookings', value: formatNumber(stats.cancelledBookings), tone: 'danger' },
    { label: 'Registered pilots', value: formatNumber(stats.totalUsers), tone: 'neutral' },
    { label: 'Inactive routes', value: formatNumber(routeSummary.inactiveRoutes), tone: 'neutral' }
  ];

  elements.operationsPulse.innerHTML = metrics.map(metric => `
    <div class="metric-row">
      <span>${escapeHtml(metric.label)}</span>
      <strong class="metric-value metric-${metric.tone}">${escapeHtml(metric.value)}</strong>
    </div>
  `).join('');
}

function renderHubAllocation(routes, fleet) {
  if (!elements.hubAllocation) return;

  const airportsByCode = Object.fromEntries((state.lookups.airports || []).map(airport => [airport.icao, airport]));
  const hubs = Array.from(new Set([
    ...routes.map(route => route.hubAirport),
    ...fleet.map(aircraft => aircraft.hub)
  ])).filter(Boolean);

  if (!hubs.length) {
    elements.hubAllocation.innerHTML = '<p class="panel-copy">No hub allocation data yet.</p>';
    return;
  }

  const maxRoutes = Math.max(...hubs.map(hub => routes.filter(route => route.hubAirport === hub).length), 1);

  elements.hubAllocation.innerHTML = hubs.map(hub => {
    const hubRoutes = routes.filter(route => route.hubAirport === hub).length;
    const hubFleet = fleet.filter(aircraft => aircraft.hub === hub && aircraft.status === 'active').length;
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
      const selectedRoute = state.routes.find(route => route.id === state.selectedRouteId);
      if (selectedRoute) {
        renderRouteForm(selectedRoute);
        return;
      }
    }

    if (state.selectedRouteId) {
      const selectedRoute = state.routes.find(route => route.id === state.selectedRouteId);
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

function renderRouteSummary(summary) {
  setText(elements.routeSummaryTotal, formatNumber(summary.totalRoutes));
  setText(elements.routeSummaryActive, formatNumber(summary.activeRoutes));
  setText(elements.routeSummaryAssigned, formatNumber(summary.routesWithAircraft));
  setText(elements.routeSummaryHubs, formatNumber(summary.hubs));
}

function renderRoutesTable() {
  if (!elements.routesTable) return;

  const query = String(elements.routeSearchInput?.value || '').trim().toLowerCase();
  const status = elements.routeStatusFilter?.value || 'all';

  const routes = state.routes.filter(route => {
    const matchesStatus = status === 'all' || route.status === status;
    if (!matchesStatus) return false;

    if (!query) return true;

    return buildRouteSearchText(route).includes(query);
  });

  if (!routes.length) {
    elements.routesTable.innerHTML = buildEmptyRow(5, 'No routes match the current filters.');
    return;
  }

  elements.routesTable.innerHTML = routes.map(route => {
    const selected = route.id === state.selectedRouteId ? ' class="is-selected"' : '';
    const scheduleLabel = route.schedules.length
      ? route.schedules
        .map(schedule => `${escapeHtml(schedule.flightNumber)} @ ${escapeHtml(shortTime(schedule.departureTime))}`)
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

function selectRoute(routeId) {
  state.selectedRouteId = Number(routeId);
  const route = state.routes.find(item => item.id === state.selectedRouteId);
  renderRouteForm(route || null);
  renderRoutesTable();
}

function startNewRoute() {
  state.selectedRouteId = null;
  renderRouteForm(null);
  renderRoutesTable();
}

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
    ? route.schedules.map(schedule => ({
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

function buildDefaultSchedule(index) {
  const defaults = ['07:00', '12:00', '18:00'];
  return {
    flightNumber: '',
    slotCode: `slot-${index}`,
    departureTime: defaults[index - 1] || '09:00',
    active: true
  };
}

function renderScheduleList(schedules) {
  if (!elements.routeSchedules) return;

  elements.routeSchedules.innerHTML = schedules.map((schedule, index) => `
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

function handleAddSchedule() {
  const schedules = readSchedulesFromForm();
  schedules.push(buildDefaultSchedule(schedules.length + 1));
  renderScheduleList(schedules);
}

function handleScheduleListClick(event) {
  const button = event.target.closest('[data-remove-schedule]');
  if (!button) return;

  const schedules = readSchedulesFromForm();
  const index = Number(button.dataset.removeSchedule);
  schedules.splice(index, 1);
  renderScheduleList(schedules.length ? schedules : [buildDefaultSchedule(1)]);
}

function readSchedulesFromForm() {
  return Array.from(elements.routeSchedules?.querySelectorAll('.schedule-card') || []).map((card, index) => ({
    flightNumber: card.querySelector('[data-schedule-field="flightNumber"]')?.value?.trim() || '',
    slotCode: card.querySelector('[data-schedule-field="slotCode"]')?.value?.trim() || `slot-${index + 1}`,
    departureTime: card.querySelector('[data-schedule-field="departureTime"]')?.value || '07:00',
    active: Boolean(card.querySelector('[data-schedule-field="active"]')?.checked)
  }));
}

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

function handleRoutesTableClick(event) {
  const row = event.target.closest('[data-route-id]');
  if (!row) return;
  selectRoute(row.dataset.routeId);
}

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

function renderFleetTable() {
  if (!elements.fleetTable) return;

  if (!state.fleet.length) {
    elements.fleetTable.innerHTML = buildEmptyRow(7, 'No aircraft found.');
    return;
  }

  elements.fleetTable.innerHTML = state.fleet.map(aircraft => {
    const assignedRoutes = state.routes.filter(route => Number(route.aircraftId) === Number(aircraft.id)).length;
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

function handleFleetTableClick(event) {
  const button = event.target.closest('[data-edit-aircraft]');
  if (!button) return;
  openAircraftModal(Number(button.dataset.editAircraft));
}

function openAircraftModal(aircraftId = null) {
  populateAircraftHubSelect();
  elements.aircraftForm?.reset();

  if (aircraftId) {
    const aircraft = state.fleet.find(item => item.id === aircraftId);
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

function closeAircraftModal() {
  elements.aircraftModal?.classList.remove('open');
}

async function handleAircraftSubmit(event) {
  event.preventDefault();

  try {
    const aircraftId = Number(elements.aircraftId?.value || 0);
    const hubAirport = (state.lookups.airports || []).find(airport => airport.icao === elements.aircraftHub?.value);
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

function renderBookingsTable() {
  if (!elements.allBookingsTable) return;

  const query = String(elements.bookingSearchInput?.value || '').trim().toLowerCase();
  const bookings = state.bookings.filter(booking => {
    if (!query) return true;
    return buildBookingSearchText(booking).includes(query);
  });

  if (!bookings.length) {
    elements.allBookingsTable.innerHTML = buildEmptyRow(10, 'No bookings match the current search.');
    return;
  }

  elements.allBookingsTable.innerHTML = bookings.map(booking => `
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

function buildStatusOptions(currentStatus) {
  return ['confirmed', 'on_time', 'delayed', 'cancelled'].map(status => `
    <option value="${status}"${status === currentStatus ? ' selected' : ''}>${escapeHtml(formatStatus(status))}</option>
  `).join('');
}

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

function renderUsersTable() {
  if (!elements.usersTable) return;

  const query = String(elements.userSearchInput?.value || '').trim().toLowerCase();
  const users = state.users.filter(user => {
    if (!query) return true;
    return buildUserSearchText(user).includes(query);
  });

  if (!users.length) {
    elements.usersTable.innerHTML = buildEmptyRow(9, 'No users match the current search.');
    return;
  }

  elements.usersTable.innerHTML = users.map(user => `
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

function renderVatsimTable() {
  if (!elements.vatsimTable) return;

  if (!state.vatsim.length) {
    elements.vatsimTable.innerHTML = buildEmptyRow(8, 'No AFV pilots are online right now.');
    return;
  }

  elements.vatsimTable.innerHTML = state.vatsim.map(pilot => `
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

function applyGlobalSearch(query) {
  const activeSection = document.querySelector(`.admin-section[data-section="${state.activeSection}"]`);
  if (!activeSection) return;

  const normalizedQuery = String(query || '').trim().toLowerCase();
  activeSection.querySelectorAll('[data-search-row]').forEach(row => {
    const searchText = String(row.dataset.searchText || '').toLowerCase();
    row.classList.toggle('hidden-by-search', Boolean(normalizedQuery) && !searchText.includes(normalizedQuery));
  });
}

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

function stampLastUpdated() {
  const now = new Date();
  setText(elements.lastUpdated, `Last updated ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
}

function setSidebarHealth(message) {
  setText(elements.sidebarHealth, message);
}

function logout() {
  localStorage.removeItem('afv_token');
  localStorage.removeItem('afv_user');
  window.location.href = 'index.html';
}

function redirectToPublicSite(message) {
  localStorage.removeItem('afv_token');
  localStorage.removeItem('afv_user');
  showToast(message, 'error');
  window.setTimeout(() => {
    window.location.href = 'index.html';
  }, 1200);
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function buildEmptyRow(columns, message) {
  return `<tr><td colspan="${columns}" class="empty-state">${escapeHtml(message)}</td></tr>`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatDuration(minutes) {
  const totalMinutes = Number(minutes || 0);
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return `${hours}h ${String(remainder).padStart(2, '0')}m`;
}

function shortTime(value) {
  const stringValue = String(value || '');
  return stringValue.length >= 5 ? stringValue.slice(0, 5) : stringValue;
}

function toTimeInputValue(value) {
  return shortTime(value);
}

function capitalise(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

function formatStatus(status) {
  return String(status || '')
    .split('_')
    .map(capitalise)
    .join(' ');
}

function statusBadgeClass(status) {
  if (status === 'cancelled') return 'badge-error';
  if (status === 'delayed' || status === 'inactive' || status === 'maintenance' || status === 'retired') return 'badge-warning';
  return 'badge-success';
}

function cabinBadgeClass(cabinClass) {
  if (cabinClass === 'first') return 'badge-gold';
  if (cabinClass === 'business') return 'badge-blue';
  return 'badge-neutral';
}

function buildRouteSearchText(route) {
  return [
    route.fromAirport,
    route.toAirport,
    route.hubAirport,
    route.fromAirportDetails?.city,
    route.toAirportDetails?.city,
    route.aircraft?.registration,
    route.aircraft?.type,
    route.schedules.map(schedule => schedule.flightNumber).join(' ')
  ].join(' ').toLowerCase();
}

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

function buildUserRoleDisabled(user) {
  if (!state.currentUser?.isPrimaryAdmin || user.isPrimaryAdmin) {
    return ' disabled';
  }

  return '';
}

function buildVatsimSearchText(pilot) {
  return [
    pilot.callsign,
    pilot.name,
    pilot.aircraft,
    pilot.from,
    pilot.to
  ].join(' ').toLowerCase();
}

function showToast(message, type = '') {
  if (!elements.toast) return;

  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type}`.trim();
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
