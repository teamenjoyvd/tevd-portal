export type RoleEvent = {
  id: string
  title: string
  start_time: string
  end_time: string
  slots: {
    HOST: string | null
    SPEAKER: string | null
    PRODUCTS: string | null
  }
}
