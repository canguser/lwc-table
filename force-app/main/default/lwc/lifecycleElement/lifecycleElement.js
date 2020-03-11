/**
 * Created by ryan on 2019-07-25.
 */

import { LightningElement, track } from 'lwc';
import Utils from 'c/utils';
import formFactorPropertyName from '@salesforce/client/formFactor';

export default class LifecycleElement extends LightningElement {
    @track
    hasInit = false;
    @track
    isProcessLoading = false;

    browserInfo = {};

    tasks = [];

    firstRendered = false;

    connectedCallback() {
        if (!this.hasInit) {
            this.hasInit = true;
            this.init();
        }
    }

    renderedCallback() {
        if (!this.firstRendered) {
            this.mounted();
            this.firstRendered = true;
        }
        if (this.tasks && this.tasks.length > 0) {
            this.tasks = this.tasks.filter(
                task => !task.action()
            );
        }
    }

    disconnectedCallback() {
    }

    errorCallback(error, stack) {
        this.handleError(error);
    }

    mounted() {
    }

    constructor() {
        super();
        this.processManager = Utils.ProcessManager.newInstance(this, {
            end() {
                this.isProcessLoading = false;
            },
            begin() {
                this.isProcessLoading = true;
            }
        });
    }

    init() {
        this.browserInfo.isMobileNomal = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.browserInfo.isMobile = formFactorPropertyName.toLowerCase() === 'small' || formFactorPropertyName.toLowerCase() === 'medium';
    }

    get isMobile() {
        // return false;
        return this.browserInfo.isMobile == null ? this.browserInfo.isMobileNomal : this.browserInfo.isMobile;
    }

    /**
     * the tasks will invoke at next rendered callback.
     * @param api
     * @param action - the task will be removed if return true.
     */
    queueTasks(
        {
            api = Utils.genID(8),
            action = () => true
        }
    ) {
        if (!this.tasks) {
            this.tasks = [];
        }
        this.tasks = this.tasks.filter(task => task.api !== api);
        this.tasks.push({ api, action });
    }

    handleError(...error) {
        Utils.error(this, ...error);
    }

    handleSuccess(...success) {
        Utils.success(this, ...success);
    }

    get isLoading() {
        return this.isProcessLoading;
    }
}