import { InstallGuide } from "@/components/pwa/InstallGuide"

export const metadata = {
  title: "Install the app – Skemaka",
  description: "Step-by-step instructions for installing Skemaka on your computer, iPhone, or Android device.",
}

export default function InstallPage() {
  return (
    <article className="max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Install Skemaka</h1>
      <p className="text-sm text-gray-500 mb-10">
        Add Skemaka to your device for one-tap access — it opens full-screen, just like a native app.
        Pick your device below for step-by-step instructions.
      </p>

      <InstallGuide />

      <p className="mt-10 text-sm text-gray-500">
        Trouble installing? Email us at{" "}
        <a
          href="mailto:gamborgc@gmail.com"
          className="font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          gamborgc@gmail.com
        </a>
        .
      </p>
    </article>
  )
}
