/* Icons the editable site content can use, by name (stored in settings). Shared by the site pages and the admin pickers. */
import { Anchor, Award, Earth, BadgeCheck, BadgeDollarSign, Beef, Boxes, Building2, CalendarCheck, Clock, Coins, Container, Eye, Factory, FlaskConical, Globe, Handshake, HeartHandshake, Landmark, Leaf, Lightbulb, Link2, MapPin, Package, PackageSearch, Plane, Recycle, Scale, Shield, ShieldCheck, Ship, ShoppingBag, Sprout, Star, Store, Target, Tractor, TrendingUp, Truck, UserCheck, Users, UtensilsCrossed, Warehouse, Wheat } from 'lucide-react'

export const STAT_ICONS = { Anchor, Award, Earth, BadgeCheck, BadgeDollarSign, Beef, Boxes, Building2, CalendarCheck, Clock, Coins, Container, Eye, Factory, FlaskConical, Globe, Handshake, HeartHandshake, Landmark, Leaf, Lightbulb, Link2, MapPin, Package, PackageSearch, Plane, Recycle, Scale, Shield, ShieldCheck, Ship, ShoppingBag, Sprout, Star, Store, Target, Tractor, TrendingUp, Truck, UserCheck, Users, UtensilsCrossed, Warehouse, Wheat }
export const STAT_ICON_NAMES = Object.keys(STAT_ICONS)
export const statIcon = name => STAT_ICONS[name] || Award
