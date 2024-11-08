export interface Config {
  bb_app_password: string;
  bb_username: string;
  bb_repos?: (string)[] | null;
  jira_token: string;
  jira_base_url: string;
  jira_username: string;
  untis_username: string;
  untis_password: string;
  openai_key: string;
  ai_method: string;
  ai_prompt: string;
  ah_username: string;
  ah_password: string;
}
