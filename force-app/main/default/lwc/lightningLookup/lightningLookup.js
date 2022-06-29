/**
 * Created by ryan on 2019-08-08.
 */

import { api, track } from 'lwc';
import LifecycleElement from 'c/lifecycleElement';
import getReferenceObjectOrigin from '@salesforce/apex/LookupHelper.getReferenceObject';
import getObjectNameOrigin from '@salesforce/apex/LookupHelper.getObjectName';
import Utils from 'c/utils';

const ActionManager = new Utils.IdentityAction();

const getReferenceObject = ActionManager.wrap({getReferenceObjectOrigin}).identity({ local: 'getReferenceObject' });
const getObjectName = ActionManager.wrap({getObjectNameOrigin}).identity({ local: 'getReferenceObject' });

export default class LightningLookup extends LifecycleElement {

    @api label = '';
    @api required = false;
    @api disabled = false;
    @api readonly = false;
    @api messageWhenValueMissing = '';
    @api validity = null;
    @api name = null;
    @api whereCase = null;
    @api variant = 'standard';
    @api fieldLevelHelp = '';

    @track _compareFields = [];
    @track _descFields = [];
    @track _noDesc = false;

    @api lookupTo = '';

    get type() {
        return this.readonly ? 'text' : 'search';
    }

    get readOnly() {
        return this.readonly;
    }

    @api set readOnly(v) {
        this.readonly = v;
    }

    @api set compareFields(v) {
        if (v != null && v !== this._compareFields) {
            this._compareFields = v;
        }
    }

    @api set descFields(v) {
        if (v != null && v !== this._descFields) {
            this._descFields = v;
        }
    }

    @api set noDesc(v) {
        if (v != null && v !== this._noDesc) {
            this._noDesc = v;
        }
    }

    @track displayValue = '';
    @track isFocus = false;
    @track isSearching = false;
    @track realValue = null;

    @track lookupItems = [];

    /* GETTER */

    get lookupUsedItems() {
        return (this.lookupItems || []).map(
            item => ({
                ...item
            })
        );
    }

    get compareFields() {
        return this._compareFields;
    }

    get descFields() {
        return this._descFields;
    }

    get noDesc() {
        return this._noDesc;
    }

    get isBlur() {
        return !this.isFocus;
    }

    get searchInput() {
        return this.template.querySelector('.searing-input');
    }

    get comboboxClass() {
        return [
            'combobox', ' slds-dropdown', ' slds-dropdown_length-with-icon-7', ' slds-dropdown_fluid',
            this.isBlur ? 'slds-hidden' : ''
        ].join(' ').trim();
    }

    get recordIcon() {
        if (!this.lookupTo || this.lookupTo.endsWith('__c')) {
            return 'custom:custom8';
        }
        return 'standard:' + this.lookupTo.toLowerCase();
    }

    get hasItems() {
        return this.lookupItems && this.lookupItems.length > 0;
    }

    get showCombobox() {
        return !this.isSearching && this.isFocus;
    }

    get selectedItem() {
        let item = this.lookupItems.find(item => item['referenceId'] === this.value);
        if (!item) {
            item = this.lookupItems.find(item => item['referenceName'] === this.displayValue);
        }
        return item || {};
    }

    get value() {
        return this.realValue;
    }

    get itemsWithDescribe() {
        return this.lookupItems.map(item => {
            const referenceDesc = item.referenceDesc || [];
            const desc = referenceDesc[0];
            return { ...item, describe: desc, noDesc: this.noDesc || !desc };
        });
    }

    @api
    get displayVal() {
        return this.displayValue;
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

    /* FUNCTION */
    whileValueChanged() {
        this.dispatchEvent(new CustomEvent('change', {
            detail: {
                value: this.value,
                name: this.name,
                label: this.displayValue
            }
        }));
        this.fetchObjectName();
    }

    preventEvent(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    handleClick(e) {
        if (!e.currentTarget) {
            return;
        }
        this.displayValue = e.currentTarget.getAttribute('data-reference-name');
        this.value = e.currentTarget.getAttribute('data-reference-id');
        this.searchInput.blur();
    }

    handleChanged(e) {
        this.displayValue = e.detail.value || '';
        if (this.displayValue === '') {
            this.value = '';
        }
        this.fetchReference();
        this.preventEvent(e);
    }

    handleFocus() {
        if (this.readonly) {
            return;
        }
        this.isFocus = true;
        this.fetchReference();
    }

    handleBlur() {
        if (this.readonly) {
            return;
        }
        this.isFocus = false;
        let selectedItem = this.selectedItem;
        this.displayValue = selectedItem['referenceName'] || '';
        if (this.value !== selectedItem['referenceId']) {
            this.value = selectedItem['referenceId'] || '';
        }
    }

    fetchReference() {
        this.isSearching = true;
        this.delay('fetchReference', 500).then(
            () => {
                this.lookupItems = [];
                return getReferenceObject({
                    recordName: this.lookupTo,
                    compareFields: this.compareFields.join(','),
                    descFields: this.descFields.join(','),
                    value: this.displayValue || '',
                    whereCase: this.whereCase
                });
            }
        ).then(lookupItems => {
            this.isSearching = false;
            this.lookupItems = lookupItems;
        }).catch(e => {
            this.isSearching = false;
            console.log(e);
        });
    }

    fetchObjectName() {
        this.isSearching = true;
        this.delay('fetchObjectName', 200).then(
            () => getObjectName({
                recordName: this.lookupTo,
                id: this.value
            })
        ).then(name => {
            this.isSearching = false;
            this.displayValue = name;
            if (this.reportValidity()) {
                this.dispatchEvent(new CustomEvent('infoload', {
                    detail: {
                        value: this.value,
                        name: this.name,
                        label: this.displayValue
                    }
                }));
            }
        }).catch(e => {
            this.isSearching = false;
            console.log(e);
        });
    }

    delay(apiName, ms) {
        const eqName = `_delay_${apiName}`;
        clearTimeout(this[eqName]);
        return new Promise(resolve => {
            this[eqName] = setTimeout(() => {
                resolve(true);
            }, ms);
        });
    }

    @api
    reportValidity() {
        if (!this.searchInput) {
            return false;
        }
        return this.searchInput.reportValidity();
    }
}