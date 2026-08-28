import { onImgError } from "../lib/format";
import { useShop } from "../context/ShopContext";

interface Props {
  className?: string;
  nameClassName?: string;
  logoClassName?: string;
}

export function ShopBrand({ className = "", nameClassName, logoClassName }: Props) {
  const { shop } = useShop();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {shop.logo ? (
        <img
          src={shop.logo}
          alt=""
          className={logoClassName ?? "h-8 w-8 rounded-full object-cover bg-white"}
          onError={onImgError}
        />
      ) : null}
      <p className={nameClassName ?? "text-xs font-semibold text-orange-700"}>{shop.name}</p>
    </div>
  );
}
