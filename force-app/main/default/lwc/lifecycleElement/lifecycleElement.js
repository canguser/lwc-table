/**
 * Created by ryan on 2019-07-25.
 */

import { LightningElement, track } from 'lwc';
import Utils from 'c/utils';
import formFactorPropertyName from '@salesforce/client/formFactor';
const isMobileNormal = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isMobile = formFactorPropertyName.toLowerCase() === 'small' || formFactorPropertyName.toLowerCase() === 'medium';
export default class LifecycleElement extends LightningElement {
    @track
    hasInit = false;
    @track
    isProcessLoading = false;
    isMounted = false;

    connectedCallback() {
        if (!this.hasInit) {
            this.hasInit = true;
            this.tasks = this.tasks || [];
            this.browserInfo = this.browserInfo || {};
            this.firstRendered = false;
            this.created();
        }
        this.init();
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
        this.destroyCallbacks.forEach(cb => {
            cb();
        });
        this.destroyCallbacks = [];
    }

    destroyCallbacks = [];
    mountedCallbacks = [];

    onDestroy(cb) {
        this.destroyCallbacks.push(cb);
    }

    errorCallback(error, stack) {
        this.handleError(error);
    }

    mounted() {
        this.mountedCallbacks.forEach(cb => {
            cb();
        });
        this.mountedCallbacks = [];
        this.isMounted = true;
    }

    onMounted(cb) {
        this.mountedCallbacks.push(cb);
    }

    afterMounted() {
        if (this.isMounted) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            this.onMounted(() => {
                resolve();
            });
        });
    }

    constructor() {
        super();
        this.processManager = Utils.registerProcessLoading(this, 'isProcessLoading', {});
    }

    created() {
    }

    init() {
    }

    get isMobile() {
        // return true;
        return isMobile == null ? isMobileNormal : isMobile;
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

    /**
     * @param cb {function=}
     */
    $nextTick(cb = () => undefined) {
        this.queueTasks({
            action() {
                cb();
                return true;
            }
        });
    }

    handleError(...error) {
        if (error.length === 0) {
            return;
        }
        Utils.error(this, ...error);
    }

    checkRenderTime(api = Utils.genID(6)) {
        console.time(api);
        this.$nextTick(() => {
            console.timeEnd(api);
        });
    }

    handleSuccess(...success) {
        Utils.success(this, ...success);
    }

    get isLoading() {
        return this.isProcessLoading;
    }
}