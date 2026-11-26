const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

function ownerLink(siteOrigin, parcelId) {
  const origin = String(siteOrigin || '');
  if (!/^https:\/\/.{3,180}$/.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/$/.test(origin) && !/^https:\/\/.{3,180}\/$/.test(origin)) {
    return '';
  }
  try {
    const url = new URL(`owner.html?parcel=${encodeURIComponent(parcelId)}`, origin.endsWith('/') ? origin : `${origin}/`);
    if (url.protocol !== 'https:' && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url.origin)) return '';
    return url.href;
  } catch {
    return '';
  }
}

exports.onParcelCreated = onDocumentCreated('parcels/{parcelId}', async (event) => {
  const parcel = event.data?.data();
  if (!parcel || parcel.status !== 'unlocked' || !parcel.empId) return;

  const db = getFirestore();
  const devices = await db.collection('devices').where('empId', '==', parcel.empId).get();
  const tokens = [...new Set(devices.docs.map((item) => item.get('token')).filter(Boolean))];
  if (!tokens.length) return;

  const company = String(parcel.courierCompany || 'a courier').slice(0, 80);
  const link = ownerLink(parcel.siteOrigin, event.params.parcelId);
  const message = {
    tokens,
    notification: {
      title: 'Parcelink',
      body: `A parcel from ${company} is in your locker`,
    },
    data: {
      parcelId: event.params.parcelId,
      locker: String(parcel.lockerNo || ''),
      url: link,
    },
  };
  if (link) message.webpush = { fcmOptions: { link } };

  const result = await getMessaging().sendEachForMulticast(message);
  const batch = db.batch();
  let removals = 0;
  result.responses.forEach((response, index) => {
    const code = response.error && response.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      const match = devices.docs.find((item) => item.get('token') === tokens[index]);
      if (match) {
        batch.delete(match.ref);
        removals += 1;
      }
    }
  });
  if (removals) await batch.commit();
});
