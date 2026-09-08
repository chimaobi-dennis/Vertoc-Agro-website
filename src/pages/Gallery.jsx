export default function Gallery() {
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center mb-12">
      <span className="text-sm font-semibold uppercase tracking-wider text-accent">Our Operations</span>
      <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Gallery</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">A glimpse into our farms, facilities, logistics, and daily operations across Nigeria.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/file_00000000a91c71f4907a39cb638741b8.png" alt="Vertoc Agro factory and processing facility" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Factory</p>
      <p className="text-white/80 text-xs">Vertoc Agro factory and processing facility</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/h11102d4d7702475faebf710f672b997dr.jpg" alt="Industrial processing equipment and storage tanks" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Processing</p>
      <p className="text-white/80 text-xs">Industrial processing equipment and storage tanks</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/img-20260701-wa0028.jpg" alt="Warehouse with stacked commodity bags ready for shipment" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Warehouse</p>
      <p className="text-white/80 text-xs">Warehouse with stacked commodity bags ready for shipment</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/img-20260702-wa0046.jpg" alt="Burlap sacks of agricultural commodities on pallets" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Storage</p>
      <p className="text-white/80 text-xs">Burlap sacks of agricultural commodities on pallets</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/ce0b7f_8e81ef90b3ec4f219e3d24d81c544cd5-mv2.jpg" alt="Traditional palm oil fruit processing in large cooking pots" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Palm Oil</p>
      <p className="text-white/80 text-xs">Traditional palm oil fruit processing in large cooking pots</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/img-20260702-wa0049.jpg" alt="Cocoa beans being weighed on a digital scale" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Cocoa</p>
      <p className="text-white/80 text-xs">Cocoa beans being weighed on a digital scale</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/vertocimage11.jpg" alt="Soybeans packed in large bulk sacks" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Soybeans</p>
      <p className="text-white/80 text-xs">Soybeans packed in large bulk sacks</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/vertocimage13.jpeg" alt="Maize harvest bagged at the farm" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Maize</p>
      <p className="text-white/80 text-xs">Maize harvest bagged at the farm</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/vertocimage14.jpeg" alt="Bulk sacks of dried maize kernels" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Maize</p>
      <p className="text-white/80 text-xs">Bulk sacks of dried maize kernels</p>
      </div>
      </button>
      <button className="relative aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left">
      <img src="/assets/img/vertocimage15.jpeg" alt="Stacked commodity bags ready for distribution" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">Storage</p>
      <p className="text-white/80 text-xs">Stacked commodity bags ready for distribution</p>
      </div>
      </button>
      </div>
      </div>
      </div>
    </main>
  )
}
