export enum HasDescriptionTypeEnum {
  AllOptions = 1,
  LastOption = 2,
  SelectedOption = 3,
}

export enum EventEnum {
  PwaFileUploadEvent = 'PwaFileUploadEvent',
  PwaFileDeleteEvent = 'PwaFileDeleteEvent',
  PwaReloadListEvent = 'PwaReloadListEvent',
  PwaGetAnswers = "Pwa:GetAnswers",
  PwaLoadAnswers = "Pwa:LoadAnswers",

  TriggerUpdateFormula = 'Update_Formula_',
  TriggerSkuDynamicEvent = 'SKU_Dynamic_',
  FilterDynamicDataEvent = 'Filter_Dynamic_data_',
  UpdateVariableInTitle = 'Update_Variable_In_Title_',
  SaveVoteData = 'SaveVoteData_',
  SaveVoteDataOnError = 'SaveVoteDataOnError_',
  
  TriggerEndOfTimerCounter = 'TriggerEndOfTimerCounter_',
}
