/* Icons the homepage stat tiles can use, by name (stored in settings). Shared by the site and the admin picker. */
import { Award, BadgeCheck, Boxes, CalendarCheck, Factory, Globe, Handshake, Leaf, MapPin, Package, ShieldCheck, Ship, Sprout, Star, Target, TrendingUp, Truck, Users, Warehouse, Wheat } from 'lucide-react'

export const STAT_ICONS = { Award, BadgeCheck, Boxes, CalendarCheck, Factory, Globe, Handshake, Leaf, MapPin, Package, ShieldCheck, Ship, Sprout, Star, Target, TrendingUp, Truck, Users, Warehouse, Wheat }
export const STAT_ICON_NAMES = Object.keys(STAT_ICONS)
export const statIcon = name => STAT_ICONS[name] || Award
