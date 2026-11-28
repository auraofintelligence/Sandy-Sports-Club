// Demo catalogue for the Sandy Sports working demo store. Every item is marked DEMO.
// Prices are illustrative only; the club has no bank account and takes no payment.
const v=(labels,stock)=>labels.map(label=>({label,stock}));
const sizes=['XS','S','M','L','XL','2XL'],kids=['Kids 4','Kids 6','Kids 8','Kids 10','Kids 12','Kids 14'];
export const DEMO_PRODUCTS=[
 // Apparel
 {sku:'APP-TEE-FOUND',name:'Founding Member tee',category:'Apparel',kind:'merch',price:35,member:30,cost:14,variants:v(sizes,12),description:'Organic cotton tee with the founding-year print. Every founding member gets one discount code at launch.'},
 {sku:'APP-RASH-ADULT',name:'Sandy rash vest (UPF 50+)',category:'Apparel',kind:'merch',price:55,member:48,cost:22,variants:v(sizes,8),description:'Long-sleeve sun protection for long days on the sand.'},
 {sku:'APP-RASH-KIDS',name:'Kids rash vest (UPF 50+)',category:'Apparel',kind:'merch',price:40,member:35,cost:16,variants:v(kids,8),description:'Junior sizes for come-and-try days and holiday clinics.'},
 {sku:'APP-SINGLET',name:'Training singlet',category:'Apparel',kind:'merch',price:38,member:32,cost:13,variants:v(sizes,10),description:'Lightweight mesh singlet in club colours.'},
 {sku:'APP-HOODIE',name:'"I ❤ Sandy Sports" hoodie',category:'Apparel',kind:'merch',price:79,member:69,cost:33,variants:v(sizes,6),description:'Heavyweight hoodie for winter sunset sessions. Say it loud.'},
 {sku:'APP-TEE-MOZZIE',name:'Minjerribah Mozzie tee',category:'Apparel',kind:'merch',price:30,member:25,cost:12,variants:v([...kids,...sizes],8),description:'Mozzie the club mascot, front and centre. Kids and adult sizes, so the whole family can match.'},
 {sku:'APP-BUCKET',name:'Bucket hat',category:'Headwear',kind:'merch',price:32,member:28,cost:11,variants:v(['S/M','L/XL'],15),description:'Wide brim, quick dry, packs flat.'},
 {sku:'APP-TRUCKER',name:'Trucker cap',category:'Headwear',kind:'merch',price:30,member:26,cost:10,variants:v(['One size'],20),description:'Embroidered Sandy Sports logo, mesh back.'},
 {sku:'APP-VISOR',name:'Court visor',category:'Headwear',kind:'merch',price:25,member:22,cost:8,variants:v(['One size'],18),description:'Keeps the sun out without trapping heat.'},
 // Club gear: branded lifestyle items only. Sports equipment is left to local stockists (Straddie Super Sports).
 {sku:'GEAR-BOTTLE',name:'Insulated drink bottle',category:'Club gear',kind:'merch',price:35,member:30,cost:13,variants:v(['750 ml'],20),description:'Stainless, keeps water cold all session. Refill, not single-use.'},
 {sku:'GEAR-TOWEL',name:'Sand-free beach towel',category:'Club gear',kind:'merch',price:45,member:39,cost:17,variants:v(['Large'],10),description:'Sand shakes straight off.'},
 // Film Club
 {sku:'FILM-TEE',name:'"Screen on the sand" Film Club tee',category:'Film Club',kind:'merch',price:35,member:30,cost:14,variants:v(sizes,8),description:'For the crew behind the outdoor cinema nights.'},
 {sku:'FILM-TOTE',name:'Film Club tote bag',category:'Film Club',kind:'merch',price:22,member:19,cost:7,variants:v(['Canvas'],15),description:'Carries a picnic rug, popcorn and a camera.'},
 {sku:'FILM-PINS',name:'Enamel pin set',category:'Film Club',kind:'merch',price:18,member:15,cost:5,variants:v(['Set of 3'],25),description:'Clapperboard, volleyball and outdoor screen pins.'},
 // Community
 {sku:'COMM-STICKERS',name:'Sticker pack',category:'Community',kind:'merch',price:8,member:6,cost:2,variants:v(['Pack of 6'],50),description:'Weatherproof stickers for boards, bottles and eskies.'},
 {sku:'COMM-POSTCARDS',name:'Three towns postcard set',category:'Community',kind:'merch',price:12,member:10,cost:3,variants:v(['Set of 3'],30),description:'Dunwich, Amity Point and Point Lookout.'},
 // Event tickets: none. Real events are added by the committee when they are confirmed.
 // Donations
 {sku:'DON-COURTS',name:'Donate to the courts and lights fund',category:'Donations',kind:'donation',price:20,member:null,cost:null,variants:[{label:'Courts and lights',stock:null}],description:'Help build lit sand courts across the three towns.'},
 {sku:'DON-SCREEN',name:'Donate to the outdoor screen fund',category:'Donations',kind:'donation',price:20,member:null,cost:null,variants:[{label:'Outdoor screen',stock:null}],description:'Help buy modular LED panels for cinema nights and live sport.'},
 {sku:'DON-JUNIOR',name:'Donate to the junior kit fund',category:'Donations',kind:'donation',price:20,member:null,cost:null,variants:[{label:'Junior kit',stock:null}],description:'Help kit out kids who cannot afford it.'}
];
// Sports equipment removed from the demo store on 28 Nov 2026 so the club does not compete with local stockists.
export const RETIRED_DEMO_TICKETS=['TIX-CINEMA-1','TIX-SUNSET-VB','TIX-COME-TRY'];
export const RETIRED_DEMO_SKUS=['GEAR-VB-BALL','GEAR-VB-NET','GEAR-FLAG-SET','GEAR-CRICKET','GEAR-DISC'];
