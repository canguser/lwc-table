/**
 * Created by ryan on 2020/5/7.
 */

import { api, track, LightningElement } from 'lwc';

export default class LightningSelector extends LightningElement {

    @api label = '';
    @api required = false;
    @api disabled = false;
    @api readonly = false;
    @api messageWhenValueMissing = '';
    @api validity = null;
    @api name = null;
    @api variant = 'standard';
    @api fieldLevelHelp = '';
    @api options = [];

    @track __value = null;
    @api _value = null; // deprecated

    get value() {
        return this.__value;
    }

    @api
    set value(v) {
        this.__value = v;
    }

    get innerValue() {
        return this.value;
    }

    set innerValue(v) {
        if (typeof v === 'number') {
            v = '' + v;
        }
        if (this.__value != null) {
            const isChanged = v !== this.__value;
            const option = {
                canChange: isChanged,
                old: this.__value,
                value: v
            };
            this.__value = v;
            isChanged && this.whileValueChanged(option);
            if (!option.canChange) {
                this.__value = option.old;
            }
        } else {
            this.__value = v;
        }
    }

    get isHideLabel() {
        return this.variant === 'label-hidden';
    }

    get mappedOptions() {
        return (this.options || []).map(option => ({
            ...option,
            selected: (option.value + '') === this.value
        }));
    }

    get selector() {
        return this.template.querySelector('.slds-select');
    }

    /* FUNCTION */
    whileValueChanged() {
        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                value: this.value,
                name: this.name
            }
        }));
    }

    @api
    focus() {
        if (this.selector) {
            this.selector.focus();
        }
    }

    @api
    blur() {
        if (this.selector) {
            this.selector.blur();
        }
    }

    @api
    reportValidity() {
    }

    handleFocus() {
        this.dispatchEvent(new CustomEvent('focus', {
            detail: {
                value: this.value,
                name: this.name
            }
        }));
    }

    handleBlur() {
        this.dispatchEvent(new CustomEvent('blur', {
            detail: {
                value: this.value,
                name: this.name
            }
        }));
    }

    handleChanged(e) {
        this.innerValue = e.target.value;
    }


}