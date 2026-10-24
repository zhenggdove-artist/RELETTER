import {equipmentById} from '../equipment-catalog.js';
import {elementMultiplier,itemElement} from '../elements.js';
export function incomingElement(g,name,element){return elementMultiplier(element,itemElement(equipmentById(g.equipment?.[name]?.outfit)));}
