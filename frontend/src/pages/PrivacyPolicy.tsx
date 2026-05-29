export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-primary-600">Yieldly</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-3 text-sm text-gray-500">Last updated: 29 May 2026</p>
        </div>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">Data We Use</h2>
            <p className="mt-2">
              Yieldly helps you review personal finance and health metrics in one private dashboard.
              If you connect WHOOP, Yieldly requests profile, recovery, cycle, sleep, and workout data
              so it can show health summaries such as recovery, HRV, resting heart rate, strain, and
              sleep performance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">How Data Is Stored</h2>
            <p className="mt-2">
              Integration tokens and summary data are stored in Yieldly's application database and are
              used only to power the connected account experience. Tokens are not exposed in the
              frontend or committed to source control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">How Data Is Used</h2>
            <p className="mt-2">
              Connected health data is used to display personal dashboards and trend summaries inside
              Yieldly. It is not sold or shared with third-party advertising services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Disconnecting Access</h2>
            <p className="mt-2">
              You can disconnect WHOOP access from the Yieldly integration flow or revoke access from
              your WHOOP account settings. Once disconnected, Yieldly will stop syncing new WHOOP data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
            <p className="mt-2">
              For privacy questions about this Yieldly instance, contact the app owner at
              {' '}
              <a className="text-primary-600 hover:underline" href="mailto:nisrj10@gmail.com">
                nisrj10@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
