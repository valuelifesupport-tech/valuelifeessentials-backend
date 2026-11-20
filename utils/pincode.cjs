/**
 * Universal Indian Postal PIN Code -> State & Union Territory Auto-Resolver
 */
function getStateFromPincode(pincode) {
  if (!pincode) return '';
  const pin = String(pincode).trim().replace(/\D/g, '');
  if (pin.length < 2) return '';
  const p2 = parseInt(pin.substring(0, 2), 10);
  const p3 = parseInt(pin.substring(0, 3), 10);
  if (p2 === 11) return 'Delhi';
  if (p2 === 12 || p2 === 13) return 'Haryana';
  if (p2 === 14 || p2 === 15) return 'Punjab';
  if (p2 === 16) return 'Chandigarh';
  if (p2 === 17) return 'Himachal Pradesh';
  if (p2 === 18 || p2 === 19) return 'Jammu and Kashmir';
  if (p2 >= 20 && p2 <= 28) return (p3 >= 248 && p3 <= 263) ? 'Uttarakhand' : 'Uttar Pradesh';
  if (p2 >= 30 && p2 <= 34) return 'Rajasthan';
  if (p2 >= 36 && p2 <= 39) return p3 === 396 ? 'Dadra and Nagar Haveli and Daman and Diu' : 'Gujarat';
  if (p2 >= 40 && p2 <= 44) return p3 === 403 ? 'Goa' : 'Maharashtra';
  if (p2 >= 45 && p2 <= 49) return (p3 >= 490 && p3 <= 497) ? 'Chhattisgarh' : 'Madhya Pradesh';
  if (p2 >= 50 && p2 <= 53) return (p3 >= 500 && p3 <= 509) ? 'Telangana' : 'Andhra Pradesh';
  if (p2 >= 56 && p2 <= 59) return 'Karnataka';
  if (p2 >= 60 && p2 <= 64) return p3 === 605 ? 'Puducherry' : 'Tamil Nadu';
  if (p2 >= 67 && p2 <= 69) return p3 === 682 ? 'Lakshadweep' : 'Kerala';
  if (p2 >= 70 && p2 <= 74) return p3 === 737 ? 'Sikkim' : (p3 === 744 ? 'Andaman and Nicobar Islands' : 'West Bengal');
  if (p2 >= 75 && p2 <= 77) return 'Odisha';
  if (p2 === 78) return 'Assam';
  if (p2 === 79) {
    if (p3 >= 790 && p3 <= 792) return 'Arunachal Pradesh';
    if (p3 >= 793 && p3 <= 794) return 'Meghalaya';
    if (p3 === 795) return 'Manipur';
    if (p3 === 796) return 'Mizoram';
    if (p3 >= 797 && p3 <= 798) return 'Nagaland';
    if (p3 === 799) return 'Tripura';
    return 'Assam';
  }
  if (p2 >= 80 && p2 <= 85) return (p3 >= 814 && p3 <= 835) ? 'Jharkhand' : 'Bihar';
  return '';
}

module.exports = { getStateFromPincode };
