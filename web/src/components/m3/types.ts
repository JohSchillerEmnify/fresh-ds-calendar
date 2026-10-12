import type { Component } from 'vue';
export interface NavItem { id: string; label: string; icon: Component; testid: string }
export interface Option<T = string> { value: T; label: string; testid?: string }
export interface MenuItem { id: string; label: string; icon?: Component; testid?: string }
export interface Swatch { value: string; name: string; color: string; testid?: string }
