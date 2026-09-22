/* Nigeria's 36 states + FCT with their capitals, and the main seaports.
   Used to drop shipment pins state by state; the client re-exports this
   from src/lib/ngStates.js. Coordinates are the capital city centre. */
export const NG_STATES = [
  { state: 'Abia', capital: 'Umuahia', lat: 5.532, lng: 7.486 },
  { state: 'Adamawa', capital: 'Yola', lat: 9.2035, lng: 12.4954 },
  { state: 'Akwa Ibom', capital: 'Uyo', lat: 5.0377, lng: 7.9128 },
  { state: 'Anambra', capital: 'Awka', lat: 6.21, lng: 7.07 },
  { state: 'Bauchi', capital: 'Bauchi', lat: 10.3158, lng: 9.8442 },
  { state: 'Bayelsa', capital: 'Yenagoa', lat: 4.9267, lng: 6.2676 },
  { state: 'Benue', capital: 'Makurdi', lat: 7.7337, lng: 8.5391 },
  { state: 'Borno', capital: 'Maiduguri', lat: 11.8311, lng: 13.151 },
  { state: 'Cross River', capital: 'Calabar', lat: 4.9757, lng: 8.3417 },
  { state: 'Delta', capital: 'Asaba', lat: 6.1978, lng: 6.7285 },
  { state: 'Ebonyi', capital: 'Abakaliki', lat: 6.3249, lng: 8.1137 },
  { state: 'Edo', capital: 'Benin City', lat: 6.335, lng: 5.6037 },
  { state: 'Ekiti', capital: 'Ado-Ekiti', lat: 7.6211, lng: 5.2214 },
  { state: 'Enugu', capital: 'Enugu', lat: 6.4584, lng: 7.5464 },
  { state: 'FCT', capital: 'Abuja', lat: 9.0765, lng: 7.3986 },
  { state: 'Gombe', capital: 'Gombe', lat: 10.2897, lng: 11.1673 },
  { state: 'Imo', capital: 'Owerri', lat: 5.4836, lng: 7.0333 },
  { state: 'Jigawa', capital: 'Dutse', lat: 11.7594, lng: 9.3389 },
  { state: 'Kaduna', capital: 'Kaduna', lat: 10.5222, lng: 7.4383 },
  { state: 'Kano', capital: 'Kano', lat: 12.0022, lng: 8.592 },
  { state: 'Katsina', capital: 'Katsina', lat: 12.9855, lng: 7.6171 },
  { state: 'Kebbi', capital: 'Birnin Kebbi', lat: 12.4539, lng: 4.1975 },
  { state: 'Kogi', capital: 'Lokoja', lat: 7.7969, lng: 6.74 },
  { state: 'Kwara', capital: 'Ilorin', lat: 8.4966, lng: 4.5421 },
  { state: 'Lagos', capital: 'Ikeja', lat: 6.6018, lng: 3.3515 },
  { state: 'Nasarawa', capital: 'Lafia', lat: 8.4939, lng: 8.515 },
  { state: 'Niger', capital: 'Minna', lat: 9.6139, lng: 6.5569 },
  { state: 'Ogun', capital: 'Abeokuta', lat: 7.1475, lng: 3.3619 },
  { state: 'Ondo', capital: 'Akure', lat: 7.2571, lng: 5.2058 },
  { state: 'Osun', capital: 'Osogbo', lat: 7.7827, lng: 4.5418 },
  { state: 'Oyo', capital: 'Ibadan', lat: 7.3775, lng: 3.947 },
  { state: 'Plateau', capital: 'Jos', lat: 9.8965, lng: 8.8583 },
  { state: 'Rivers', capital: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  { state: 'Sokoto', capital: 'Sokoto', lat: 13.0059, lng: 5.2476 },
  { state: 'Taraba', capital: 'Jalingo', lat: 8.8932, lng: 11.36 },
  { state: 'Yobe', capital: 'Damaturu', lat: 11.747, lng: 11.9608 },
  { state: 'Zamfara', capital: 'Gusau', lat: 12.1628, lng: 6.6612 },
]
export const NG_PORTS = [
  { name: 'Apapa Port, Lagos', state: 'Lagos', lat: 6.4474, lng: 3.3627 },
  { name: 'Tin Can Island Port, Lagos', state: 'Lagos', lat: 6.4318, lng: 3.345 },
  { name: 'Lekki Deep Sea Port, Lagos', state: 'Lagos', lat: 6.4079, lng: 4.0836 },
  { name: 'Onne Port, Rivers', state: 'Rivers', lat: 4.6924, lng: 7.1469 },
  { name: 'Port Harcourt Port, Rivers', state: 'Rivers', lat: 4.7626, lng: 7.0163 },
  { name: 'Warri Port, Delta', state: 'Delta', lat: 5.5167, lng: 5.75 },
  { name: 'Calabar Port, Cross River', state: 'Cross River', lat: 4.97, lng: 8.32 },
]
export const NG_STATE_NAMES = NG_STATES.map(s => s.state)
export const stateByName = name => NG_STATES.find(s => s.state.toLowerCase() === String(name || '').trim().toLowerCase()) || null
/** The state whose capital is closest to a point — a fair guess for a pin dropped on the map. */
export function nearestState({ lat, lng }) {
  let best = null, d = Infinity
  for (const s of NG_STATES) { const dd = (s.lat - lat) ** 2 + (s.lng - lng) ** 2; if (dd < d) { d = dd; best = s } }
  return best
}
