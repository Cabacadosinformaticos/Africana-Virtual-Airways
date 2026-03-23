function parseJsonField(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeStringToMinutes(timeString) {
  const [hours = '0', minutes = '0', seconds = '0'] = String(timeString).split(':');
  return Number(hours) * 60 + Number(minutes) + Math.floor(Number(seconds) / 60);
}

function combineDateAndTime(dateString, timeString) {
  const normalizedTime = String(timeString).length === 5 ? `${timeString}:00` : String(timeString);
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes, seconds] = normalizedTime.split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0, 0);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function formatDurationMinutes(totalMinutes) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}h ${pad(minutes)}m`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function dayOffset(fromDate, toDate) {
  return Math.round((startOfDay(toDate).getTime() - startOfDay(fromDate).getTime()) / 86400000);
}

function formatDisplayTime(date, referenceDate) {
  const value = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (!referenceDate) return value;
  const offset = dayOffset(referenceDate, date);
  return offset > 0 ? `${value}+${offset}` : value;
}

function buildSegmentKey(flightNumber, departureDate) {
  return `${flightNumber}|${departureDate}`;
}

module.exports = {
  addMinutes,
  buildSegmentKey,
  combineDateAndTime,
  dayOffset,
  formatDisplayTime,
  formatDurationMinutes,
  formatIsoDate,
  parseJsonField,
  timeStringToMinutes
};
