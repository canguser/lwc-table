/**
 * Created by ryan on 2019/12/23.
 */

import { api, track } from 'lwc';
import LifecycleElement from 'c/lifecycleElement';

const exchangePosition = (position) => {
    const strategy = {
        right: 'left',
        left: 'right',
        top: 'bottom',
        bottom: 'top'
    };
    return strategy[position] || position;
};

export default class LightningPrivateMenuItem extends LifecycleElement {


    static ITEM_TEMPLATE = {
        label: '',
        value: '',
        icon: '',
        iconPosition: 'right', // right, left
        readonly: false,
        children: []
    };


    @api
    items = [];

    @api
    orientation = 'right';

    get computedItems() {
        return this.items.map(
            item => ({
                ...LightningPrivateMenuItem.ITEM_TEMPLATE,
                iconPosition: this.orientation,
                ...item
            })
        ).map(
            (item, i, items) => ({
                ...item,
                hasChildren: item.children.length > 0,
                childrenSize: item.children.length,
                hasIcon: !!items.find(it => ['right', 'left'].includes(it.iconPosition) && it.icon)
            })
        ).map(item => ({
            ...item,
            isRightIcon: (item.hasIcon && item.iconPosition === 'right') || (item.hasChildren && this.orientation === 'right'),
            isLeftIcon: item.hasIcon && item.iconPosition === 'left' || (item.hasChildren && this.orientation === 'left'),
            key: item.value,
            liClass: [
                'slds-dropdown__item',
                item.hasChildren > 0 ? 'slds-has-submenu' : ''
            ].join(' '),
            iconClass: [
                `slds-m-left_small`,
                'slds-shrink-none'
            ].join(' '),
            icon: item.hasChildren ? `utility:${this.orientation}` : item.icon,
            subClass: [
                'slds-dropdown slds-dropdown_submenu',
                `slds-dropdown_submenu-${this.orientation}`
            ].join(' '),
            aClass: [].join(' ')
        }));
    }

    handleTouchItem(e) {
        const ele = e.currentTarget;
        if (ele) {
            const value = ele.getAttribute('data-value');
            const item = this.computedItems.find(item => item.key === value);
            if (item) {
                this.dispatchEvent(new CustomEvent('touchitem', {
                    bubbles: true,
                    composed: true,
                    detail: { ...item }
                }));
            }
        }
    }
}