import { BRAND } from '../brand';

export default function BrandMark() {
  return <a href="#topo" className="marketing-brand" aria-label={`${BRAND.name}, início`}><img src="/brand/logo-mark.svg" alt="" /><span>MONITORA<i>360</i></span></a>;
}
