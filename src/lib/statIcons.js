/* Icons the editable site content can use, by name (stored in settings). Shared by the site pages and the admin pickers. */
import { Anchor, Award, BadgeCheck, Beef, Boxes, Building2, CalendarCheck, Coins, Container, Eye, Factory, Globe, Handshake, HeartHandshake, Landmark, Leaf, Lightbulb, MapPin, Package, Plane, Recycle, Scale, Shield, ShieldCheck, Ship, ShoppingBag, Sprout, Star, Store, Target, Tractor, TrendingUp, Truck, Users, UtensilsCrossed, Warehouse, Wheat } from 'lucide-react'

export const STAT_ICONS = { Anchor, Award, BadgeCheck, Beef, Boxes, Building2, CalendarCheck, Coins, Container, Eye, Factory, Globe, Handshake, HeartHandshake, Landmark, Leaf, Lightbulb, MapPin, Package, Plane, Recycle, Scale, Shield, ShieldCheck, Ship, ShoppingBag, Sprout, Star, Store, Target, Tractor, TrendingUp, Truck, Users, UtensilsCrossed, Warehouse, Wheat }
export const STAT_ICON_NAMES = Object.keys(STAT_ICONS)
export const statIcon = name => STAT_ICONS[name] || Award
