/**
 * Created by ryan on 2019-08-09.
 */
import { api, track } from 'lwc';
import LifecycleElement from 'c/lifecycleElement';
import { LightningElement } from 'lwc';

export default class LightningMultipicklist extends LifecycleElement {
    @api label = '';
    @api required = false;
    @api disabled = false;
    @api readonly = false;
    @api name = null;
    @api variant = '';
    @api size = 4;

    @api options = [];

    @track isFocus = false;
    @track realValue = '';

    /* GETTER */
    get isBlur() {
        return !this.isFocus;
    }

    get value() {
        return this.realValue;
    }

    get hideLabel() {
        return this.variant === 'label-hidden';
    }

    get selectedValues() {
        return this.value.split(';').map(v => v.trim());
    }

    get parsedOptions() {
        return this.options.map(option => ({
            ...option, selected: this.selectedValues.includes(option.value), key: Symbol()
        }));
    }

    /* SETTER */
    @api
    set value(v) {
        const isChanged = v !== this.realValue;
        const option = {
            canChange: isChanged,
            old: this.realValue,
            value: v
        };
        this.realValue = v;
        isChanged && this.whileValueChanged(option);
        if (!option.canChange) {
            this.realValue = option.old;
        }
    }

    set selectedValues(values) {
        this.value = values.join(';');
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

    whileSelectorChanged(e) {
        const selectedOptions = [...e.target.selectedOptions];
        this.selectedValues = selectedOptions.map(option => option.value);
    }
}