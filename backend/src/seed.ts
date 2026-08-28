import type { Database } from "./types.js";

export function createSeedData(): Database {
  return {
    categories: [
      { id: "cat-starter", name: "ອາຫານວ່າງ" },
      { id: "cat-main", name: "ອາຫານຫຼັກ" },
      { id: "cat-drink", name: "ເຄື່ອງດື່ມ" },
      { id: "cat-dessert", name: "ຂອງຫວານ" },
    ],
    products: [
      {
        id: "prod-goi-cuon",
        name: "ຍໍ່ກົວນກຸ້ງຊີ້ນ",
        price: 35000,
        image:
          "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=800&q=80",
        description: "ແຜ່ນຂາວຫໍ່ກຸ້ງ, ຊີ້ນຕົ້ມ, ເສັ້ນ ແລະ ຜັກສົດ. ຈິ້ມນ້ຳປາແຕງ.",
        categoryId: "cat-starter",
        available: true,
      },
      {
        id: "prod-cha-gio",
        name: "ປໍເປີຍະທອງ",
        price: 40000,
        image:
          "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80",
        description: "ປໍເປີຍະທອດກອບ ໃສ່ຊີ້ນ, ເຫັດຫູໜູ, ຝອຍ. ກິນກັບຜັກສົດ.",
        categoryId: "cat-starter",
        available: true,
      },
      {
        id: "prod-pho-bo",
        name: "ເຝີງົວລວກ-ຕົ້ມ",
        price: 65000,
        image:
          "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80",
        description: "ນ້ຳສຸກໄຂ່ງົວ, ເສັ້ນເຝີນຸ່ມ, ຊີ້ນງົວລວກ ແລະ ຕົ້ມ, ຜັກບົ່ວກັບຜັກຊີ.",
        categoryId: "cat-main",
        available: true,
      },
      {
        id: "prod-bun-cha",
        name: "ບຸ່ນຈ໋າ ຮ່າໂນ້ຍ",
        price: 60000,
        image:
          "https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=800&q=80",
        description: "ລູກຊີ້ນ ແລະ ຊີ້ນປີ້ງ, ເສັ້ນບຸ່ນ, ນ້ຳປາຫວານ.",
        categoryId: "cat-main",
        available: true,
      },
      {
        id: "prod-com-tam",
        name: "ເຂົ້າແຜ່ນຊີ້ນກະດູກ",
        price: 55000,
        image:
          "https://images.unsplash.com/photo-1512055565422-40d3669c1d5d?auto=format&fit=crop&w=800&q=80",
        description: "ເຂົ້າແຜ່ນ, ກະດູກປີ້ງ, ຊີ້ນຟັນ, ໄຂ່ຕົ້ມ, ຜັກແດດດິວ ແລະ ນ້ຳມັນຜັກບົ່ວ.",
        categoryId: "cat-main",
        available: true,
      },
      {
        id: "prod-bun-bo",
        name: "ບຸ່ນງົວເຫວ",
        price: 65000,
        image:
          "https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?auto=format&fit=crop&w=800&q=80",
        description: "ນ້ຳສຸກຫົວສິງ-ໝາກເຜັດ, ຂໍ້ຕີນໝູ, ປາແລັດ, ເສັ້ນບຸ່ນໃຫຍ່.",
        categoryId: "cat-main",
        available: true,
      },
      {
        id: "prod-ga-nuong",
        name: "ໄກ່ປີ້ງນ້ຳເຜິ້ງ",
        price: 89000,
        image:
          "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=800&q=80",
        description: "ນົງໄກ່ປີ້ງນ້ຳເຜິ້ງຫອມຜິວ, ກິນກັບເຂົ້າໜຽວ ຫຼື ເຂົ້າຈ້າວ.",
        categoryId: "cat-main",
        available: true,
      },
      {
        id: "prod-tra-dao",
        name: "ຊາພີກ ໝາກກ້ຽງ ຫົວສິງ",
        price: 28000,
        image:
          "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80",
        description: "ຊາດຳ, ພີກ, ໝາກກ້ຽງສົດ ແລະ ຫົວສິງຫອມ. ສັ່ງນ້ຳກ້ອນໜ້ອຍໄດ້.",
        categoryId: "cat-drink",
        available: true,
      },
      {
        id: "prod-nuoc-cam",
        name: "ນ້ຳໝາກກ້ຽງຄັ້ນ",
        price: 30000,
        image:
          "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=800&q=80",
        description: "ນ້ຳໝາກກ້ຽງຄັ້ນບໍລິສຸດ, ບໍ່ໃສ່ນ້ຳຕານ. ຊື່ນເຢັນ.",
        categoryId: "cat-drink",
        available: true,
      },
      {
        id: "prod-ca-phe",
        name: "ກາເຟນົມເຢັນ",
        price: 25000,
        image:
          "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
        description: "ກາເຟຂົ້ນ, ນົມຂົ້ນ, ນ້ຳກ້ອນ. ລົດເຂັ້ມຫອມ.",
        categoryId: "cat-drink",
        available: true,
      },
      {
        id: "prod-che-thai",
        name: "ນ້ຳໝາກໄມ້ໄທ",
        price: 25000,
        image:
          "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80",
        description: "ໝາກໄມ້, ວຸ້ນ, ລຳໄຍ, ກະທິ. ຫວານຊື່ນເຢັນ.",
        categoryId: "cat-dessert",
        available: true,
      },
      {
        id: "prod-flan",
        name: "ຂະໜົມຟລານ",
        price: 20000,
        image:
          "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=800&q=80",
        description: "ຂະໜົມຟລານນຸ່ມ, ນ້ຳຕານເຜົາຂົມນ້ອຍ. ກິນເຢັນ.",
        categoryId: "cat-dessert",
        available: true,
      },
    ],
    orders: [],
    staffCalls: [],
  };
}
