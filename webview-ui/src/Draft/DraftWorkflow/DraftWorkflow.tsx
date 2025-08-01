import { FormEvent, useEffect } from "react";
import {
    CreateParams,
    InitialState,
    LaunchAttachAcrToClusterParams,
} from "../../../../src/webview-contract/webviewDefinitions/draft/draftWorkflow";
import {
    DeploymentSpecType,
    GitHubRepo,
    HelmDeploymentParams,
    HelmOverride,
    ManifestsDeploymentParams,
    NewOrExisting,
    Subscription,
} from "../../../../src/webview-contract/webviewDefinitions/draft/types";
import { Lazy, map as lazyMap } from "../../utilities/lazy";
import {
    Validatable,
    hasMessage,
    invalid,
    isValid,
    isValueSet,
    missing,
    orDefault,
    toNullable,
    unset,
    valid,
} from "../../utilities/validation";
import {
    EventHandlerFunc,
    ensureAcrsLoaded,
    ensureAcrRepositoryNamesLoaded,
    ensureBranchNamesLoaded,
    ensureClustersLoaded,
    ensureClusterNamespacesLoaded,
    ensureSubscriptionsLoaded,
} from "./dataLoading";
import { DraftWorkflowState, HelmOverrideState, stateUpdater, vscode } from "./state";
import { useStateManagement } from "../../utilities/state";
import styles from "../Draft.module.css";
import { Maybe, isNothing, just, nothing } from "../../utilities/maybe";
import { ResourceSelector } from "../../components/ResourceSelector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimesCircle, faTrash } from "@fortawesome/free-solid-svg-icons";
import { faFolder } from "@fortawesome/free-regular-svg-icons";
import { distinct, filterNulls, replaceItem } from "../../utilities/array";
import { TextWithDropdown } from "../../components/TextWithDropdown";
import * as l10n from "@vscode/l10n";
export function DraftWorkflow(initialState: InitialState) {
    const { state, eventHandlers } = useStateManagement(stateUpdater, initialState, vscode);

    const updates: EventHandlerFunc[] = [];
    const {
        lazyBranchNames,
        lazySubscriptions,
        lazyClusterResourceGroups,
        lazyClusterNames,
        lazyNamespaces,
        lazyAcrResourceGroups,
        lazyAcrNames,
        lazyRepositoryNames,
    } = prepareData(state, updates);
    useEffect(() => {
        updates.map((fn) => fn(eventHandlers));
    });

    function handleDraftDockerfileClick(e: React.MouseEvent) {
        e.preventDefault();
        vscode.postLaunchDraftDockerfile();
    }

    function handleDraftDeploymentClick(e: React.MouseEvent) {
        e.preventDefault();
        vscode.postLaunchDraftDeployment();
    }

    function handleWorkflowNameChange(e: Event | FormEvent<HTMLElement>) {
        const name = (e.currentTarget as HTMLInputElement).value;
        const validated = getValidatedWorkflowName(name);
        eventHandlers.onSetSelectedWorkflowName(validated);

        function getValidatedWorkflowName(name: string): Validatable<string> {
            if (!name) return missing(l10n.t("Workflow name is required."));

            // TODO: valid filename checking
            if (state.existingWorkflowFiles.some((f) => f.name === name)) {
                return invalid(name, l10n.t("Workflow with this name already exists."));
            }

            return valid(name);
        }
    }

    function handleGitHubRepoSelect(repo: GitHubRepo | null) {
        const validated = repo === null ? missing<GitHubRepo>(l10n.t("GitHub repository is required.")) : valid(repo);
        eventHandlers.onSetSelectedGitHubRepo(validated);
    }

    function handleBranchSelect(branch: string | null) {
        const validated = branch === null ? missing<string>(l10n.t("Branch is required.")) : valid(branch);
        eventHandlers.onSetSelectedBranchName(validated);
    }

    function handleSubscriptionSelect(subscription: Subscription | null) {
        const validated =
            subscription === null ? missing<Subscription>(l10n.t("Subscription is required.")) : valid(subscription);
        eventHandlers.onSetSelectedSubscription(validated);
    }

    function handleChooseDockerfileClick() {
        vscode.postPickFilesRequest({
            identifier: "Dockerfile",
            options: {
                defaultPath: state.workspaceConfig.fullPath,
                type: "file",
                title: "Dockerfile",
                buttonLabel: l10n.t("Select"),
                filters: { Dockerfile: ["Dockerfile"] },
            },
        });
    }

    function handleChooseBuildContextClick() {
        vscode.postPickFilesRequest({
            identifier: "BuildContext",
            options: {
                defaultPath: state.workspaceConfig.fullPath,
                type: "directory",
                title: l10n.t("Build context path"),
                buttonLabel: l10n.t("Select"),
            },
        });
    }

    function handleAcrResourceGroupSelect(resourceGroup: string | null) {
        const validated =
            resourceGroup === null ? missing<string>(l10n.t("ACR Resource Group is required.")) : valid(resourceGroup);
        eventHandlers.onSetSelectedAcrResourceGroup(validated);
    }

    function handleAcrSelect(acr: string | null) {
        const validated = acr === null ? missing<string>(l10n.t("ACR is required.")) : valid(acr);
        eventHandlers.onSetSelectedAcr(validated);
    }

    function handleRepositorySelect(repository: string | null, isNew: boolean) {
        const validated = getValidatedRepository();
        eventHandlers.onSetSelectedRepositoryName(validated);

        function getValidatedRepository(): Validatable<NewOrExisting<string>> {
            if (!repository) return missing(l10n.t("Azure Container Registry image is required."));
            return valid({ isNew, value: repository });
        }
    }

    function handleClusterResourceGroupSelect(resourceGroup: string | null) {
        const validated =
            resourceGroup === null
                ? missing<string>(l10n.t("Cluster Resource Group is required."))
                : valid(resourceGroup);
        eventHandlers.onSetSelectedClusterResourceGroup(validated);
    }

    function handleClusterSelect(cluster: string | null) {
        const validated = cluster === null ? missing<string>(l10n.t("Cluster is required.")) : valid(cluster);
        eventHandlers.onSetSelectedCluster(validated);
    }

    function handleNamespaceSelect(namespace: string | null, isNew: boolean) {
        const validated = getValidatedNamespace();
        eventHandlers.onSetSelectedClusterNamespace(validated);

        function getValidatedNamespace(): Validatable<NewOrExisting<string>> {
            if (!namespace) return missing(l10n.t("Namespace is required."));
            return valid({ isNew, value: namespace });
        }
    }

    function handleDeploymentSpecTypeChange(e: Event | FormEvent<HTMLElement>) {
        const type = (e.currentTarget as HTMLInputElement).value as DeploymentSpecType;
        eventHandlers.onSetSelectedDeploymentSpecType(type);
    }

    function handleChooseManifestPathsClick() {
        vscode.postPickFilesRequest({
            identifier: "Manifests",
            options: {
                defaultPath: state.workspaceConfig.fullPath,
                type: "file",
                title: l10n.t("Select all Manifest Files"),
                buttonLabel: l10n.t("Select Files"),
                filters: { YAML: ["yaml", "yml"] },
                canSelectMany: true,
            },
        });
    }

    function handleDeleteManifestPathClick(path: string) {
        if (isValid(state.manifestsParamsState.selectedManifestPaths)) {
            const currentPaths = state.manifestsParamsState.selectedManifestPaths.value;
            const newPaths = currentPaths.filter((p) => p !== path);
            if (newPaths.length === 0) {
                eventHandlers.onSetSelectedManifestPaths(missing(l10n.t("Manifest paths are required.")));
            } else {
                eventHandlers.onSetSelectedManifestPaths(valid(newPaths));
            }
        }
    }

    function handleChooseHelmChartFolderClick() {
        vscode.postPickFilesRequest({
            identifier: "HelmCharts",
            options: {
                defaultPath: state.workspaceConfig.fullPath,
                type: "directory",
                title: l10n.t("{0} charts folder", "Helm"),
                buttonLabel: l10n.t("Select"),
            },
        });
    }

    function handleChooseHelmValuesFileClick() {
        vscode.postPickFilesRequest({
            identifier: "HelmValuesYaml",
            options: {
                defaultPath: state.workspaceConfig.fullPath,
                type: "file",
                title: l10n.t("{0} file", "Helm Values.yaml"),
                buttonLabel: l10n.t("Select"),
                filters: { YAML: ["yaml", "yml"] },
            },
        });
    }

    function handleOverrideKeyChange(e: Event | FormEvent<HTMLElement>, override: HelmOverrideState) {
        const key = (e.currentTarget as HTMLInputElement).value;
        const validated = getValidatedOverrideKey(key);
        const overrides = replaceItem(
            state.helmParamsState.selectedOverrides,
            (o) => o === override, // reference equality works here because the override value comes directly from the state
            (o) => ({ ...o, key: validated }),
        );
        eventHandlers.onSetSelectedHelmOverrides(overrides);

        function getValidatedOverrideKey(key: string): Validatable<string> {
            key = key.trim();

            if (!key) return missing(l10n.t("Key is required."));
            const otherKeys = state.helmParamsState.selectedOverrides
                .filter((o) => o !== override)
                .map((o) => o.key)
                .filter(isValueSet)
                .map((k) => k.value);
            if (otherKeys.includes(key)) return invalid(key, l10n.t("Key already exists."));

            // TODO: valid key checking
            return valid(key);
        }
    }

    function handleOverrideValueChange(e: Event | FormEvent<HTMLElement>, override: HelmOverrideState) {
        const value = (e.currentTarget as HTMLInputElement).value;
        const validated = getValidatedOverrideValue(value);
        const overrides = replaceItem(
            state.helmParamsState.selectedOverrides,
            (o) => o === override, // reference equality works here because the override value comes directly from the state
            (o) => ({ ...o, value: validated }),
        );
        eventHandlers.onSetSelectedHelmOverrides(overrides);

        function getValidatedOverrideValue(value: string): Validatable<string> {
            if (!value) return missing(l10n.t("Value is required."));

            // TODO: Valid value checking
            return valid(value);
        }
    }

    function handleDeleteOverrideClick(override: HelmOverrideState) {
        const overrides = state.helmParamsState.selectedOverrides.filter((o) => o !== override);
        eventHandlers.onSetSelectedHelmOverrides(overrides);
    }

    function handleAddHelmOverrideClick() {
        eventHandlers.onSetSelectedHelmOverrides([
            ...state.helmParamsState.selectedOverrides,
            { key: unset(), value: unset() },
        ]);
    }

    function handleLaunchAttachAcrToClusterClick(e: React.MouseEvent) {
        e.preventDefault();
        const params: LaunchAttachAcrToClusterParams = {
            initialSubscriptionId: orDefault(state.selectedSubscription, null)?.id || null,
            initialAcrResourceGroup: orDefault(state.selectedAcrResourceGroup, null) || null,
            initialAcrName: orDefault(state.selectedAcr, null) || null,
            initialClusterResourceGroup: orDefault(state.selectedClusterResourceGroup, null) || null,
            initialClusterName: orDefault(state.selectedCluster, null) || null,
        };

        vscode.postLaunchAttachAcrToCluster(params);
    }

    function validate(): Maybe<CreateParams> {
        if (!isValid(state.selectedWorkflowName)) return nothing();
        if (!isValid(state.selectedBranchName)) return nothing();
        if (!isValid(state.selectedSubscription)) return nothing();
        if (!isValid(state.selectedDockerfilePath)) return nothing();
        if (!isValid(state.selectedAcrResourceGroup)) return nothing();
        if (!isValid(state.selectedAcr)) return nothing();
        if (!isValid(state.selectedRepositoryName)) return nothing();
        if (!isValid(state.selectedClusterResourceGroup)) return nothing();
        if (!isValid(state.selectedCluster)) return nothing();
        if (!isValid(state.selectedClusterNamespace)) return nothing();

        const deploymentParams = validateDeploymentParams();
        if (isNothing(deploymentParams)) return nothing();

        const result: CreateParams = {
            workflowName: state.selectedWorkflowName.value,
            branchName: state.selectedBranchName.value,
            subscriptionId: state.selectedSubscription.value.id,
            dockerfilePath: state.selectedDockerfilePath.value,
            buildContextPath: state.selectedBuildContextPath,
            acrResourceGroup: state.selectedAcrResourceGroup.value,
            acrName: state.selectedAcr.value,
            repositoryName: state.selectedRepositoryName.value.value,
            clusterResourceGroup: state.selectedClusterResourceGroup.value,
            clusterName: state.selectedCluster.value,
            namespace: state.selectedClusterNamespace.value.value,
            deploymentParams: deploymentParams.value,
        };

        return just(result);
    }

    function validateDeploymentParams(): Maybe<ManifestsDeploymentParams | HelmDeploymentParams> {
        switch (state.selectedDeploymentSpecType) {
            case "manifests": {
                if (!isValid(state.manifestsParamsState.selectedManifestPaths)) return nothing();
                return just({
                    deploymentType: "manifests",
                    manifestPaths: state.manifestsParamsState.selectedManifestPaths.value,
                });
            }
            case "helm": {
                if (!isValid(state.helmParamsState.selectedChartPath)) return nothing();
                if (!isValid(state.helmParamsState.selectedValuesYamlPath)) return nothing();
                const overrides = validateHelmOverrides(state.helmParamsState.selectedOverrides);
                if (isNothing(overrides)) return nothing();
                return just({
                    deploymentType: "helm",
                    chartPath: state.helmParamsState.selectedChartPath.value,
                    valuesYamlPath: state.helmParamsState.selectedValuesYamlPath.value,
                    overrides: overrides.value,
                });
            }
            default:
                return nothing();
        }
    }

    function validateHelmOverrides(overridesState: HelmOverrideState[]): Maybe<HelmOverride[]> {
        const overrides: (HelmOverride | null)[] = overridesState.map((o) => {
            if (!isValid(o.key) || !isValid(o.value)) return null;
            return { key: o.key.value, value: o.value.value };
        });
        if (overrides.some((o) => o === null)) return nothing();
        return just(filterNulls(overrides));
    }

    function handleFormSubmit(e: FormEvent) {
        e.preventDefault();
        const createParams = validate();
        if (isNothing(createParams)) {
            return;
        }

        eventHandlers.onSetCreating();
        vscode.postCreateWorkflowRequest(createParams.value);
    }

    const existingFile = getExistingFile(state, state.selectedWorkflowName);

    const gitHubRepoTooltipMessage = l10n.t(
        "Select the primary/upstream fork of this repository.\n\nThis will allow you to select which branch will trigger the workflow.",
    );

    const namespaceTooltipMessage =
        "To create a new namespace, write the desired name in the field. If the namespace does not already exist, it will be not be created until the workflow runs.";

    return (
        <>
            <form className={styles.wrapper} onSubmit={handleFormSubmit}>
                <h2>{l10n.t("Automated Deployments: Draft a GitHub Workflow")}</h2>
                <p className={styles.fullWidth}>
                    {l10n.t(
                        "Generate a workflow to deploy to Azure Kubernetes Service (AKS). Before running this command, make sure you have created a Dockerfile and Deployment. You can do this using the",
                    )}{" "}
                    <a href="#" onClick={handleDraftDockerfileClick}>
                        {l10n.t("Automated Deployments: Create a Dockerfile")}
                    </a>{" "}
                    and{" "}
                    <a href="#" onClick={handleDraftDeploymentClick}>
                        {l10n.t("Automated Deployments: Create a Deployment")}
                    </a>{" "}
                    {l10n.t("commands.")}
                </p>

                <h3 className={styles.fullWidth}>{l10n.t("Workflow properties")}</h3>
                <fieldset className={styles.inputContainer} disabled={state.status !== "Editing"}>
                    <label htmlFor="workflow-name-input" className={styles.label}>
                        {l10n.t("Workflow name *")}
                    </label>
                    <input
                        type="text"
                        id="workflow-name-input"
                        value={orDefault(state.selectedWorkflowName, "")}
                        className={styles.control}
                        onBlur={handleWorkflowNameChange}
                        onInput={handleWorkflowNameChange}
                    />
                    {hasMessage(state.selectedWorkflowName) && (
                        <span className={styles.validationMessage}>
                            <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                            {state.selectedWorkflowName.message}
                        </span>
                    )}

                    <label htmlFor="gh-repo-input" className={styles.label}>
                        {l10n.t("GitHub repository *")}
                        <span className={"tooltip-holder"} data-tooltip-text={gitHubRepoTooltipMessage}>
                            <i className={`${styles.inlineIcon} codicon codicon-info`} />
                        </span>
                    </label>
                    <ResourceSelector<GitHubRepo>
                        id="gh-repo-input"
                        className={styles.control}
                        resources={state.gitHubReferenceData.repositories.map((r) => r.repository)}
                        selectedItem={toNullable(state.selectedGitHubRepo)}
                        valueGetter={(r) => r.url}
                        labelGetter={(r) => `${r.gitHubRepoOwner}/${r.gitHubRepoName} (${r.forkName})`}
                        onSelect={handleGitHubRepoSelect}
                    />

                    {isValid(state.selectedGitHubRepo) && (
                        <>
                            <label htmlFor="branch-input" className={styles.label}>
                                {l10n.t("Branch *")}
                            </label>
                            <ResourceSelector<string>
                                id="branch-input"
                                className={styles.control}
                                resources={lazyBranchNames}
                                selectedItem={toNullable(state.selectedBranchName)}
                                valueGetter={(b) => b}
                                labelGetter={(b) => b}
                                onSelect={handleBranchSelect}
                            />
                            {hasMessage(state.selectedBranchName) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.selectedBranchName.message}
                                </span>
                            )}
                        </>
                    )}

                    <label htmlFor="subscription-input" className={styles.label}>
                        {l10n.t("Subscription *")}
                    </label>
                    <ResourceSelector<Subscription>
                        id="subscription-input"
                        className={styles.control}
                        resources={lazySubscriptions}
                        selectedItem={toNullable(state.selectedSubscription)}
                        valueGetter={(l) => l.id}
                        labelGetter={(l) => l.name}
                        onSelect={handleSubscriptionSelect}
                    />
                    {hasMessage(state.selectedSubscription) && (
                        <span className={styles.validationMessage}>
                            <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                            {state.selectedSubscription.message}
                        </span>
                    )}

                    <h3 className={styles.fullWidth}>Build details</h3>

                    <label htmlFor="dockerfile-input" className={styles.label}>
                        Dockerfile *
                    </label>
                    <input
                        type="text"
                        id="dockerfile-input"
                        value={
                            isValueSet(state.selectedDockerfilePath)
                                ? `.${state.workspaceConfig.pathSeparator}${state.selectedDockerfilePath.value}`
                                : ""
                        }
                        readOnly
                        className={styles.control}
                    />
                    <div className={styles.controlSupplement}>
                        <button className="choose-location-button" onClick={handleChooseDockerfileClick}>
                            <span className={styles.iconButton}>
                                <FontAwesomeIcon icon={faFolder} />
                                &nbsp;{l10n.t("Choose")} Dockerfile
                            </span>
                        </button>
                    </div>
                    {hasMessage(state.selectedDockerfilePath) && (
                        <span className={styles.validationMessage}>
                            <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                            {state.selectedDockerfilePath.message}
                        </span>
                    )}

                    <label htmlFor="build-context-input" className={styles.label}>
                        {l10n.t("Build context *")}
                    </label>
                    <input
                        type="text"
                        id="build-context-input"
                        value={`.${state.workspaceConfig.pathSeparator}${state.selectedBuildContextPath}`}
                        readOnly
                        className={styles.control}
                    />
                    <div className={styles.controlSupplement}>
                        <button className="choose-location-button" onClick={handleChooseBuildContextClick}>
                            <span className={styles.iconButton}>
                                <FontAwesomeIcon icon={faFolder} />
                                &nbsp;{l10n.t("Choose build context")}
                            </span>
                        </button>
                    </div>

                    {isValid(state.selectedSubscription) && (
                        <>
                            <h3 className={styles.fullWidth}>Azure Container Registry details</h3>
                            <label htmlFor="acr-rg-input" className={styles.label}>
                                {l10n.t("ACR Resource Group *")}
                            </label>
                            <ResourceSelector<string>
                                id="acr-rg-input"
                                className={styles.control}
                                resources={lazyAcrResourceGroups}
                                selectedItem={toNullable(state.selectedAcrResourceGroup)}
                                valueGetter={(g) => g}
                                labelGetter={(g) => g}
                                onSelect={handleAcrResourceGroupSelect}
                            />
                            {hasMessage(state.selectedAcrResourceGroup) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.selectedAcrResourceGroup.message}
                                </span>
                            )}
                        </>
                    )}

                    {isValid(state.selectedAcrResourceGroup) && (
                        <>
                            <label htmlFor="acr-input" className={styles.label}>
                                {l10n.t("Container Registry *")}
                            </label>
                            <ResourceSelector<string>
                                id="acr-input"
                                className={styles.control}
                                resources={lazyAcrNames}
                                selectedItem={toNullable(state.selectedAcr)}
                                valueGetter={(c) => c}
                                labelGetter={(c) => c}
                                onSelect={handleAcrSelect}
                            />
                            {hasMessage(state.selectedAcr) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.selectedAcr.message}
                                </span>
                            )}
                        </>
                    )}

                    {isValid(state.selectedAcr) && (
                        <>
                            <label htmlFor="acr-repo-input" className={styles.label}>
                                {l10n.t("Azure Container Registry image *")}
                            </label>

                            <TextWithDropdown
                                id="acr-repo-input"
                                className={styles.control}
                                getAddItemText={(text) => `Use "${text}"`}
                                items={lazyRepositoryNames}
                                selectedItem={toNullable(state.selectedRepositoryName)?.value || null}
                                onSelect={handleRepositorySelect}
                            />

                            {hasMessage(state.selectedRepositoryName) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.selectedRepositoryName.message}
                                </span>
                            )}
                        </>
                    )}

                    <h3 className={styles.fullWidth}>Deployment details</h3>

                    {isValid(state.selectedSubscription) && (
                        <>
                            <label htmlFor="cluster-rg-input" className={styles.label}>
                                {l10n.t("Cluster Resource Group *")}
                            </label>
                            <ResourceSelector<string>
                                id="cluster-rg-input"
                                className={styles.control}
                                resources={lazyClusterResourceGroups}
                                selectedItem={toNullable(state.selectedClusterResourceGroup)}
                                valueGetter={(g) => g}
                                labelGetter={(g) => g}
                                onSelect={handleClusterResourceGroupSelect}
                            />
                            {hasMessage(state.selectedClusterResourceGroup) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.selectedClusterResourceGroup.message}
                                </span>
                            )}
                        </>
                    )}

                    {isValid(state.selectedClusterResourceGroup) && (
                        <>
                            <label htmlFor="cluster-input" className={styles.label}>
                                {l10n.t("Cluster *")}
                            </label>
                            <ResourceSelector<string>
                                id="cluster-input"
                                className={styles.control}
                                resources={lazyClusterNames}
                                selectedItem={toNullable(state.selectedCluster)}
                                valueGetter={(c) => c}
                                labelGetter={(c) => c}
                                onSelect={handleClusterSelect}
                            />
                            {hasMessage(state.selectedCluster) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.selectedCluster.message}
                                </span>
                            )}
                        </>
                    )}

                    {isValid(state.selectedCluster) && (
                        <>
                            <label htmlFor="namespace-input" className={styles.label}>
                                {l10n.t("Namespace *")}
                                <span className={"tooltip-holder"} data-tooltip-text={namespaceTooltipMessage}>
                                    <i className={`${styles.inlineIcon} codicon codicon-info`} />
                                </span>
                            </label>

                            <TextWithDropdown
                                id="namespace-input"
                                className={styles.control}
                                getAddItemText={(text) => `Use "${text}"`}
                                items={lazyNamespaces}
                                selectedItem={toNullable(state.selectedClusterNamespace)?.value || null}
                                onSelect={handleNamespaceSelect}
                            />

                            {hasMessage(state.selectedClusterNamespace) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.selectedClusterNamespace.message}
                                </span>
                            )}
                        </>
                    )}

                    <label htmlFor="deployment-type-input" className={styles.label}>
                        {l10n.t("Type")}
                    </label>

                    <div id="deployment-type-input" className={styles.control}>
                        <div className={styles.radioLine}>
                            <input
                                type="radio"
                                name="deployment-type"
                                value="manifests"
                                checked={state.selectedDeploymentSpecType === "manifests"}
                                onChange={handleDeploymentSpecTypeChange}
                            />

                            <label className={styles.radioLabel}>Manifests</label>
                        </div>
                        <div className={styles.radioLine}>
                            <input
                                type="radio"
                                name="deployment-type"
                                value="helm"
                                checked={state.selectedDeploymentSpecType === "helm"}
                                onChange={handleDeploymentSpecTypeChange}
                            />
                            <label className={styles.radioLabel}>Helm</label>
                        </div>
                    </div>

                    {state.selectedDeploymentSpecType === "manifests" && (
                        <>
                            <label htmlFor="manifest-paths" className={styles.label}>
                                Manifest {l10n.t("file paths *")}
                            </label>
                            <div className={styles.control}>
                                <button className="choose-location-button" onClick={handleChooseManifestPathsClick}>
                                    <span className={styles.iconButton}>
                                        <FontAwesomeIcon icon={faFolder} />
                                        &nbsp;{l10n.t("Choose")} manifest {l10n.t("file paths")}
                                    </span>
                                </button>
                            </div>
                            {isValid(state.manifestsParamsState.selectedManifestPaths) && (
                                <ul className={`${styles.existingFileList} ${styles.control}`} id="manifest-paths">
                                    {state.manifestsParamsState.selectedManifestPaths.value.map((path, i) => (
                                        <li key={i} className={styles.removable}>
                                            <a
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    vscode.postOpenFileRequest(path);
                                                }}
                                            >
                                                {path}
                                            </a>
                                            <button
                                                className="icon-button"
                                                onClick={() => handleDeleteManifestPathClick(path)}
                                                aria-label={l10n.t("Remove")}
                                                title={l10n.t("Remove")}
                                            >
                                                <FontAwesomeIcon className={styles.linkColor} icon={faTrash} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {hasMessage(state.manifestsParamsState.selectedManifestPaths) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.manifestsParamsState.selectedManifestPaths.message}
                                </span>
                            )}
                        </>
                    )}

                    {state.selectedDeploymentSpecType === "helm" && (
                        <>
                            <label htmlFor="chart-path-input" className={styles.label}>
                                {l10n.t("Chart path *")}
                            </label>
                            <input
                                type="text"
                                id="chart-path-input"
                                value={
                                    isValid(state.helmParamsState.selectedChartPath)
                                        ? `.${state.workspaceConfig.pathSeparator}${state.helmParamsState.selectedChartPath.value} `
                                        : ""
                                }
                                readOnly
                                className={styles.control}
                            />
                            <div className={styles.controlSupplement}>
                                <button className="choose-location-button" onClick={handleChooseHelmChartFolderClick}>
                                    <span className={styles.iconButton}>
                                        <FontAwesomeIcon icon={faFolder} />
                                        &nbsp;{l10n.t("Choose {0} chart folder", "Helm")}
                                    </span>
                                </button>
                            </div>
                            {hasMessage(state.helmParamsState.selectedChartPath) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.helmParamsState.selectedChartPath.message}
                                </span>
                            )}

                            <label htmlFor="values-path-input" className={styles.label}>
                                Values.yaml {l10n.t("path")} *
                            </label>
                            <input
                                type="text"
                                id="values-path-input"
                                value={
                                    isValid(state.helmParamsState.selectedValuesYamlPath)
                                        ? `.${state.workspaceConfig.pathSeparator}${state.helmParamsState.selectedValuesYamlPath.value}`
                                        : ""
                                }
                                readOnly
                                className={styles.control}
                            />
                            <div className={styles.controlSupplement}>
                                <button className="choose-location-button" onClick={handleChooseHelmValuesFileClick}>
                                    <span className={styles.iconButton}>
                                        <FontAwesomeIcon icon={faFolder} />
                                        &nbsp;{l10n.t("Choose")} values.yaml {l10n.t("file")}
                                    </span>
                                </button>
                            </div>
                            {hasMessage(state.helmParamsState.selectedValuesYamlPath) && (
                                <span className={styles.validationMessage}>
                                    <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                    {state.helmParamsState.selectedValuesYamlPath.message}
                                </span>
                            )}

                            <label className={styles.label}>Overrides</label>
                            {state.helmParamsState.selectedOverrides.map((o, i) => (
                                <>
                                    <div key={i} className={styles.control} style={{ display: "flex" }}>
                                        <input
                                            type="text"
                                            id={`override-key-input-${i}`}
                                            className={`${styles.longControl} ${styles.validatable}`}
                                            onBlur={(e) => handleOverrideKeyChange(e, o)}
                                            onInput={(e) => handleOverrideKeyChange(e, o)}
                                            value={orDefault(o.key, "")}
                                        />
                                        =
                                        <input
                                            type="text"
                                            id={`override-value-input-${i}`}
                                            className={`${styles.longControl} ${styles.validatable}`}
                                            onBlur={(e) => handleOverrideValueChange(e, o)}
                                            onInput={(e) => handleOverrideValueChange(e, o)}
                                            value={orDefault(o.value, "")}
                                        />
                                        <button
                                            className="icon-button"
                                            onClick={() => handleDeleteOverrideClick(o)}
                                            aria-label={l10n.t("Remove")}
                                            title={l10n.t("Remove")}
                                        >
                                            <FontAwesomeIcon className={styles.linkColor} icon={faTrash} />
                                        </button>
                                    </div>
                                    {hasMessage(o.key) && (
                                        <span className={styles.validationMessage}>
                                            <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                            {o.key.message}
                                        </span>
                                    )}
                                    {hasMessage(o.value) && (
                                        <span className={styles.validationMessage}>
                                            <FontAwesomeIcon className={styles.errorIndicator} icon={faTimesCircle} />
                                            {o.value.message}
                                        </span>
                                    )}
                                </>
                            ))}
                            <div
                                className={
                                    state.helmParamsState.selectedOverrides.length === 0
                                        ? styles.control
                                        : styles.controlSupplement
                                }
                            >
                                <button className="choose-location-button" onClick={handleAddHelmOverrideClick}>
                                    <span className={styles.iconButton}>
                                        <FontAwesomeIcon icon={faPlus} />
                                        &nbsp;{l10n.t("Add override")}
                                    </span>
                                </button>
                            </div>
                        </>
                    )}
                </fieldset>

                <div className={styles.buttonContainer}>
                    {state.status !== "Created" && (
                        <button type="submit" disabled={state.status !== "Editing" || isNothing(validate())}>
                            {l10n.t("Create")}
                        </button>
                    )}

                    {existingFile && (
                        <button className="secondary-button" onClick={() => vscode.postOpenFileRequest(existingFile)}>
                            {l10n.t("Open Workflow File")}
                        </button>
                    )}
                </div>

                {state.status === "Created" && (
                    <div className={styles.nextStepsContainer}>
                        <i className={`codicon codicon-sparkle ${styles.icon}`}></i>
                        <div className={styles.content}>
                            <h3>{l10n.t("Next steps")}</h3>

                            <p>
                                {l10n.t(
                                    "To ensure the generated workflow file runs correctly, you will need to ensure",
                                )}
                                <ul>
                                    <li>
                                        {l10n.t("The ACR")}{" "}
                                        {isValueSet(state.selectedAcr) ? `(${state.selectedAcr.value})` : ""}{" "}
                                        <a href="#" onClick={handleLaunchAttachAcrToClusterClick}>
                                            {l10n.t("is attached")}
                                        </a>{" "}
                                        {l10n.t("to the cluster")}{" "}
                                        {isValueSet(state.selectedCluster) ? `(${state.selectedCluster.value})` : ""}.
                                        {l10n.t("You can follow for guidance")}.
                                    </li>
                                    <li>
                                        {l10n.t("Your GitHub repository")}{" "}
                                        {isValueSet(state.selectedGitHubRepo)
                                            ? `(${state.selectedGitHubRepo.value.gitHubRepoOwner}/${state.selectedGitHubRepo.value.gitHubRepoName})`
                                            : ""}{" "}
                                        <a href="https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure">
                                            {l10n.t("is configured")}
                                        </a>{" "}
                                        {l10n.t("to access the ACR and cluster.")}
                                    </li>
                                </ul>
                            </p>
                        </div>
                    </div>
                )}
            </form>
        </>
    );
}

type LocalData = {
    lazyBranchNames: Lazy<string[]>;
    lazySubscriptions: Lazy<Subscription[]>;
    lazyClusterResourceGroups: Lazy<string[]>;
    lazyClusterNames: Lazy<string[]>;
    lazyNamespaces: Lazy<string[]>;
    lazyAcrResourceGroups: Lazy<string[]>;
    lazyAcrNames: Lazy<string[]>;
    lazyRepositoryNames: Lazy<string[]>;
};

function prepareData(state: DraftWorkflowState, updates: EventHandlerFunc[]): LocalData {
    const lazyClusters = ensureClustersLoaded(
        state.azureReferenceData,
        toNullable(state.selectedSubscription),
        updates,
    );
    const lazyClusterResourceGroups = lazyMap(lazyClusters, (clusters) =>
        distinct(clusters.map((c) => c.resourceGroup)),
    );
    const clusterResourceGroup = toNullable(state.selectedClusterResourceGroup);
    const lazyClusterNames = lazyMap(lazyClusters, (clusters) =>
        clusters.filter((c) => c.resourceGroup === clusterResourceGroup).map((c) => c.clusterName),
    );

    const lazyAcrs = ensureAcrsLoaded(state.azureReferenceData, toNullable(state.selectedSubscription), updates);
    const acrResourceGroup = toNullable(state.selectedAcrResourceGroup);
    const lazyAcrResourceGroups = lazyMap(lazyAcrs, (acrs) => distinct(acrs.map((a) => a.resourceGroup)));
    const lazyAcrNames = lazyMap(lazyAcrs, (acrs) =>
        acrs.filter((a) => a.resourceGroup === acrResourceGroup).map((a) => a.acrName),
    );
    return {
        lazyBranchNames: ensureBranchNamesLoaded(
            state.gitHubReferenceData,
            toNullable(state.selectedGitHubRepo),
            updates,
        ),
        lazySubscriptions: ensureSubscriptionsLoaded(state.azureReferenceData, updates),
        lazyClusterResourceGroups,
        lazyClusterNames,
        lazyNamespaces: ensureClusterNamespacesLoaded(
            state.azureReferenceData,
            toNullable(state.selectedSubscription),
            toNullable(state.selectedClusterResourceGroup),
            toNullable(state.selectedCluster),
            updates,
        ),
        lazyAcrResourceGroups,
        lazyAcrNames,
        lazyRepositoryNames: ensureAcrRepositoryNamesLoaded(
            state.azureReferenceData,
            toNullable(state.selectedSubscription),
            toNullable(state.selectedAcrResourceGroup),
            toNullable(state.selectedAcr),
            updates,
        ),
    };
}

function getExistingFile(state: DraftWorkflowState, workflowName: Validatable<string>): string | null {
    if (!isValueSet(workflowName)) {
        return null;
    }

    const file = state.existingWorkflowFiles.find((f) => f.name.toLowerCase() === workflowName.value.toLowerCase());
    return file ? file.path : null;
}
