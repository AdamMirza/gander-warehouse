import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="absolute inset-0 opacity-20">
          <Image
            src="/warehouse-hero.jpg"
            alt="Warehouse interior"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="container mx-auto px-6 relative z-10 text-white">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Streamline Your Aviation Parts Management
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-slate-200">
              Advanced inventory tracking and rapid fulfillment for the aviation industry.
              Your trusted partner in parts management excellence.
            </p>
            <div className="flex gap-4">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                Request Parts
              </button>
              <button className="bg-transparent border-2 border-white hover:bg-white hover:text-slate-900 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-slate-900">
            Why Choose Gander Warehouse?
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                title: "Real-Time Inventory",
                description: "Track parts availability instantly with our advanced digital system",
                icon: "🔍"
              },
              {
                title: "Global Network",
                description: "Access to worldwide aviation parts network with rapid delivery",
                icon: "🌐"
              },
              {
                title: "Certified Quality",
                description: "All parts meet strict aviation industry standards and certifications",
                icon: "✓"
              }
            ].map((feature, index) => (
              <div key={index} className="bg-slate-50 p-8 rounded-xl hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-slate-100">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">
                Comprehensive Parts Management Solutions
              </h2>
              <div className="space-y-4">
                {[
                  "Automated parts request processing",
                  "24/7 inventory monitoring",
                  "Emergency AOG support",
                  "Custom reporting and analytics",
                  "Predictive maintenance insights"
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
              <button className="mt-8 bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
                Schedule a Demo
              </button>
            </div>
            <div className="flex-1 relative h-[400px] w-full">
              <Image
                src="/dashboard-preview.jpg"
                alt="Dashboard preview"
                fill
                className="object-cover rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
