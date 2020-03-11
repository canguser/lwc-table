/**
 * Created by ryan on 2019/11/8.
 */

import { LightningElement, api, track } from 'lwc';

export default class LightningHelpText extends LightningElement {

    _iconVariant = 'info'; // 'warning', 'success', 'error'
    @api iconName = 'utility:info';
    @api content = '';
    @api nubbin = 'bottom-left';

    get popoverClassName() {
        return [
            'slds-popover', 'slds-popover_tooltip', 'popover-tooltip',
            'slds-nubbin_' + this.nubbin,
            'popover-tooltip_' + this.nubbin
        ].join(' ');
    }

    get contentSplits() {
        return this.content.split('\n').map(
            (split, i) => ({
                key: i,
                value: split
            })
        );
    }

    get iconVariant() {
        if (!['info', 'warning', 'success', 'error'].includes(this._iconVariant)) {
            return 'info';
        }
        return this._iconVariant;
    }

    @api
    set iconVariant(variant) {
        this._iconVariant = variant;
    }
}