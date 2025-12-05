import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { CreditCard, Trash as Transfer, Banknote, BarChart3, Users, Shield, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
    });
  }, []);

  const features = [
    {
      icon: CreditCard,
      title: 'Input Modal',
      description: 'Kelola modal dari berbagai aplikasi seperti Karangsari, Fastpay, MMBC, PayFazz, Posfin'
    },
    {
      icon: Transfer,
      title: 'Transfer Uang',
      description: 'Proses transfer uang dengan pencatatan biaya dan cetak struk otomatis'
    },
    {
      icon: Banknote,
      title: 'Tarik Tunai',
      description: 'Kelola penarikan tunai dari berbagai bank dengan perhitungan biaya'
    },
    {
      icon: BarChart3,
      title: 'Laporan Lengkap',
      description: 'Laporan harian, mingguan, bulanan dengan export PDF dan Excel'
    },
    {
      icon: Users,
      title: 'Multi User',
      description: 'Akses kasir dan owner dengan pembatasan hak akses yang jelas'
    },
    {
      icon: Shield,
      title: 'Keamanan Data',
      description: 'Data transaksi aman dengan sistem approval owner untuk setiap transaksi'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <CreditCard className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl md:text-2xl font-bold text-gray-900">KARANG SARI GROUP</span>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition duration-300"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center" data-aos="fade-up">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Sistem Pembukuan Kasir
              <span className="text-blue-600"> Professional</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Kelola semua transaksi kasir Anda dengan mudah dan efisien. 
              Dari input modal hingga laporan keuangan lengkap.
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => navigate('/login')}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition duration-300 flex items-center"
              >
                Mulai Sekarang
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16" data-aos="fade-up">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Fitur Lengkap</h2>
            <p className="text-xl text-gray-600">
              Semua yang Anda butuhkan untuk mengelola pembukuan kasir
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-gray-50 p-6 rounded-xl hover:shadow-lg transition duration-300"
                data-aos="fade-up"
                data-aos-delay={index * 100}
              >
                <feature.icon className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div data-aos="fade-up">
            <h2 className="text-4xl font-bold text-white mb-6">
              Siap Memulai?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Bergabunglah dan rasakan kemudahan mengelola pembukuan kasir Anda
            </p>
            <button 
              onClick={() => navigate('/login')}
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition duration-300"
            >
              Login Sekarang
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <CreditCard className="h-8 w-8 text-blue-400" />
              <span className="ml-2 text-xl md:text-2xl font-bold">KARANG SARI GROUP</span>
            </div>
            <p className="text-gray-400">
              © 2025 KARANG SARI GROUP. Semua hak dilindungi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;