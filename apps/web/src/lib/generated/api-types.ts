import type {
  AdjustmentAllocationValue,
  AdjustmentTypeValue,
  ChefRoleValue,
  CollectionSystemTypeValue,
  EntryStatusValue,
  PaymentStatusValue,
  RestaurantPlatformValue,
  SystemRoleValue,
} from '@ff-restaurent/shared';
export interface paths {
  '/address/provinces': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getAddressProvinces'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/address/provinces/{provinceCode}/wards': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getAddressProvincesByProvinceCodeWards'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/admin/password-reset-requests': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getAdminPassword-reset-requests'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/admin/password-reset-requests/{id}/issue': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postAdminPassword-reset-requestsByIdIssue'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/admin/password-reset-requests/{id}/reject': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postAdminPassword-reset-requestsByIdReject'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/admin/root-transfer': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postAdminRoot-transfer'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/auth/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postAuthLogin'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/auth/password-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postAuthPassword-reset'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/auth/password-reset-requests': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postAuthPassword-reset-requests'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/auth/register': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postAuthRegister'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/bills': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getBills'];
    put?: never;
    post: operations['postBills'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/bills/{billId}/feedback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postBillsByBillIdFeedback'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/bills/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getBillsById'];
    put: operations['putBillsById'];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/bills/{id}/activity': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getBillsByIdActivity'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/bills/{id}/archive': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchBillsByIdArchive'];
    trace?: never;
  };
  '/bills/{id}/participants/{memberId}/payment': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchBillsByIdParticipantsByMemberIdPayment'];
    trace?: never;
  };
  '/bills/{id}/payment-qr-options': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getBillsByIdPayment-qr-options'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/bills/{id}/reminders': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postBillsByIdReminders'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/bills/{id}/restore': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchBillsByIdRestore'];
    trace?: never;
  };
  '/collections': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getCollections'];
    put?: never;
    post: operations['postCollections'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/collections/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getCollectionsById'];
    put: operations['putCollectionsById'];
    post?: never;
    delete: operations['deleteCollectionsById'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/collections/{id}/restaurants': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getCollectionsByIdRestaurants'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/collections/{id}/restaurants/{restaurantId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postCollectionsByIdRestaurantsByRestaurantId'];
    delete: operations['deleteCollectionsByIdRestaurantsByRestaurantId'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/collections/{id}/shares': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getCollectionsByIdShares'];
    put?: never;
    post: operations['postCollectionsByIdShares'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/collections/{id}/shares/{userId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: operations['deleteCollectionsByIdSharesByUserId'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/cuisines': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getCuisines'];
    put?: never;
    post: operations['postCuisines'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/cuisines/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putCuisinesById'];
    post?: never;
    delete: operations['deleteCuisinesById'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/dining-areas': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getDining-areas'];
    put?: never;
    post: operations['postDining-areas'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/dining-areas/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putDining-areasById'];
    post?: never;
    delete: operations['deleteDining-areasById'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/feedback/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putFeedbackById'];
    post?: never;
    delete: operations['deleteFeedbackById'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getHealth'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getMe'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/me/avatar': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putMeAvatar'];
    post?: never;
    delete: operations['deleteMeAvatar'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/me/notification-preferences': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getMeNotification-preferences'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchMeNotification-preferences'];
    trace?: never;
  };
  '/me/password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchMePassword'];
    trace?: never;
  };
  '/me/payment-qr-images': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getMePayment-qr-images'];
    put?: never;
    post: operations['postMePayment-qr-images'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/me/payment-qr-images/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: operations['deleteMePayment-qr-imagesById'];
    options?: never;
    head?: never;
    patch: operations['patchMePayment-qr-imagesById'];
    trace?: never;
  };
  '/me/payment-qr-images/{id}/replacement': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postMePayment-qr-imagesByIdReplacement'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/me/profile': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putMeProfile'];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/members': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getMembers'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/notifications': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getNotifications'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/notifications/{id}/read': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchNotificationsByIdRead'];
    trace?: never;
  };
  '/notifications/read-all': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchNotificationsRead-all'];
    trace?: never;
  };
  '/participant-groups': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getParticipant-groups'];
    put?: never;
    post: operations['postParticipant-groups'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/participant-groups/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putParticipant-groupsById'];
    post?: never;
    delete: operations['deleteParticipant-groupsById'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/ready': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getReady'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/restaurants': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getRestaurants'];
    put?: never;
    post: operations['postRestaurants'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/restaurants/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getRestaurantsById'];
    put: operations['putRestaurantsById'];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/restaurants/{id}/archive': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchRestaurantsByIdArchive'];
    trace?: never;
  };
  '/restaurants/{id}/banner': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putRestaurantsByIdBanner'];
    post?: never;
    delete: operations['deleteRestaurantsByIdBanner'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/restaurants/{id}/collections': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putRestaurantsByIdCollections'];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/restaurants/{id}/favorite': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations['postRestaurantsByIdFavorite'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/restaurants/{id}/feedback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getRestaurantsByIdFeedback'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/restaurants/{id}/logo': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: operations['putRestaurantsByIdLogo'];
    post?: never;
    delete: operations['deleteRestaurantsByIdLogo'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/restaurants/{id}/recommend': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchRestaurantsByIdRecommend'];
    trace?: never;
  };
  '/restaurants/{id}/restore': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchRestaurantsByIdRestore'];
    trace?: never;
  };
  '/stats/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getStatsMe'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/users': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getUsers'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/users/{id}/chef-role': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: operations['patchUsersByIdChef-role'];
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    /** @enum {string} */
    AdjustmentAllocation: AdjustmentAllocationValue;
    /** @enum {string} */
    AdjustmentType: AdjustmentTypeValue;
    Bill: {
      adjustmentAllocation: components['schemas']['AdjustmentAllocation'];
      baseCost: number;
      /** Format: date-time */
      createdAt: string;
      createdBy: {
        avatarUrl?: string | null;
        chefRole: components['schemas']['ChefRole'] | null;
        /** Format: date-time */
        createdAt?: string;
        id: string;
        name: string;
        phone?: string | null;
        systemRole: components['schemas']['SystemRole'] | null;
        username: string;
      } & {
        [key: string]: unknown;
      };
      createdById: string;
      discounts: ({
        label?: string;
        type: components['schemas']['AdjustmentType'];
        value: number;
      } & {
        [key: string]: unknown;
      })[];
      id: string;
      participants: ({
        allocatedShipping: number;
        allocatedVat: number;
        discountApplied: number;
        finalPrice: number;
        member: {
          avatarUrl?: string | null;
          chefRole: components['schemas']['ChefRole'] | null;
          /** Format: date-time */
          createdAt?: string;
          id: string;
          name: string;
          phone?: string | null;
          systemRole: components['schemas']['SystemRole'] | null;
          username: string;
        } & {
          [key: string]: unknown;
        };
        memberId: string;
        originCost: number;
        /** Format: date-time */
        paidAt?: string | null;
        paymentStatus: components['schemas']['PaymentStatus'];
      } & {
        [key: string]: unknown;
      })[];
      paymentQrImage?:
        | ({
            id: string;
            imageUrl: string;
            label: string;
            status: components['schemas']['EntryStatus'];
          } & {
            [key: string]: unknown;
          })
        | null;
      paymentQrImageId?: string | null;
      paymentUrl?: string | null;
      qrCodePath?: string | null;
      restaurant: components['schemas']['RestaurantEntry'];
      shippingFee: number;
      status: components['schemas']['EntryStatus'];
      totalCost: number;
      /** Format: date-time */
      updatedAt: string;
      vat: number;
      vouchers: ({
        code: string;
        value: number;
      } & {
        [key: string]: unknown;
      })[];
    } & {
      [key: string]: unknown;
    };
    /** @enum {string} */
    ChefRole: ChefRoleValue;
    Collection: {
      _count: {
        restaurants: number;
        shares: number;
      } & {
        [key: string]: unknown;
      };
      /** Format: date-time */
      createdAt: string;
      description?: string | null;
      id: string;
      isPublic: boolean;
      name: string;
      owner?:
        | ({
            id: string;
            name: string;
            username: string;
          } & {
            [key: string]: unknown;
          })
        | null;
      ownerId?: string | null;
      systemType: components['schemas']['CollectionSystemType'] | null;
      /** Format: date-time */
      updatedAt: string;
    } & {
      [key: string]: unknown;
    };
    /** @enum {string} */
    CollectionSystemType: CollectionSystemTypeValue;
    /** @enum {string} */
    EntryStatus: EntryStatusValue;
    /** @enum {string} */
    PaymentStatus: PaymentStatusValue;
    RestaurantEntry: {
      address: string;
      addressLine?: string | null;
      avatarUrl?: string | null;
      bannerImageUrl?: string | null;
      /** Format: date-time */
      createdAt?: string;
      createdById?: string;
      cuisines?: ({
        cuisine: {
          description?: string | null;
          id: string;
          name: string;
          type: string;
        } & {
          [key: string]: unknown;
        };
        isPrimary: boolean;
      } & {
        [key: string]: unknown;
      })[];
      cuisineType: string;
      diningArea?:
        | ({
            address: string;
            addressLine?: string | null;
            description?: string | null;
            id: string;
            name: string;
            provinceCode?: string | null;
            provinceName?: string | null;
            wardCode?: string | null;
            wardName?: string | null;
          } & {
            [key: string]: unknown;
          })
        | null;
      diningAreaId?: string | null;
      feedbackAggregates?: {
        feedbackCount: number;
        foodRating: number | null;
        serviceRating: number | null;
      } & {
        [key: string]: unknown;
      };
      id: string;
      isFavorite: boolean;
      isFavoritedByMe?: boolean;
      isRecommended: boolean;
      name: string;
      phone?: string | null;
      platformLinks?: ({
        id?: string;
        label?: string | null;
        platform: components['schemas']['RestaurantPlatform'];
        sortOrder?: number;
        url: string;
      } & {
        [key: string]: unknown;
      })[];
      provinceCode?: string | null;
      provinceName?: string | null;
      status: components['schemas']['EntryStatus'];
      type: string;
      /** Format: date-time */
      updatedAt?: string;
      wardCode?: string | null;
      wardName?: string | null;
    } & {
      [key: string]: unknown;
    };
    /** @enum {string} */
    RestaurantPlatform: RestaurantPlatformValue;
    /** @enum {string} */
    SystemRole: SystemRoleValue;
    User: {
      avatarUrl?: string | null;
      chefRole: components['schemas']['ChefRole'] | null;
      /** Format: date-time */
      createdAt?: string;
      id: string;
      name: string;
      paymentRemindersEnabled?: boolean;
      phone?: string | null;
      roles: string[];
      systemRole: components['schemas']['SystemRole'] | null;
      username: string;
    } & {
      [key: string]: unknown;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  getAddressProvinces: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getAddressProvincesByProvinceCodeWards: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        provinceCode: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'getAdminPassword-reset-requests': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postAdminPassword-reset-requestsByIdIssue': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postAdminPassword-reset-requestsByIdReject': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postAdminRoot-transfer': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          confirmationUsername: string;
          currentPassword: string;
          targetUsername: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postAuthLogin: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          identifier: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            token: string;
            user: components['schemas']['User'];
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postAuthPassword-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          code: string;
          confirmation: string;
          identifier: string;
          newPassword: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postAuthPassword-reset-requests': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': unknown;
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postAuthRegister: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          inviteCode: string;
          name: string;
          password: string;
          phone?: string | ('null' | null);
          username: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            token: string;
            user: components['schemas']['User'];
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getBills: {
    parameters: {
      query?: {
        archive?: 'active' | 'archived' | 'all';
        cursor?: string;
        direction?: 'forward' | 'backward';
        from?: string;
        limit?: number;
        ownerId?: string;
        participantId?: string;
        participantIds?: string;
        paymentStatus?: components['schemas']['PaymentStatus'];
        restaurantId?: string;
        sort?: 'created-desc' | 'created-asc' | 'total-desc' | 'total-asc';
        to?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: components['schemas']['Bill'][];
            pageInfo: {
              endCursor: string | null;
              hasNextPage: boolean;
              hasPreviousPage?: boolean;
              startCursor?: string | null;
            } & {
              [key: string]: unknown;
            };
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postBills: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          adjustmentAllocation?: components['schemas']['AdjustmentAllocation'];
          /** @default false */
          allowDuplicate?: boolean;
          baseCost: number;
          discounts?: {
            label?: string;
            type: components['schemas']['AdjustmentType'];
            value: number;
          }[];
          participants: {
            memberId: string;
            originCost?: number;
          }[];
          paymentQrImageId?: string | null;
          /** Format: uri */
          paymentUrl?: string;
          restaurantId: string;
          shippingFee: number;
          vat: number;
          vouchers?: {
            code: string;
            value: number;
          }[];
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Bill'];
        };
      };
    };
  };
  postBillsByBillIdFeedback: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        billId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          comment?: string | null;
          foodRating: number;
          serviceRating: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getBillsById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Bill'];
        };
      };
    };
  };
  putBillsById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          adjustmentAllocation?: components['schemas']['AdjustmentAllocation'];
          /** @default false */
          allowDuplicate?: boolean;
          baseCost: number;
          discounts?: {
            label?: string;
            type: components['schemas']['AdjustmentType'];
            value: number;
          }[];
          participants: {
            memberId: string;
            originCost?: number;
          }[];
          paymentQrImageId?: string | null;
          /** Format: uri */
          paymentUrl?: string;
          restaurantId: string;
          shippingFee: number;
          vat: number;
          vouchers?: {
            code: string;
            value: number;
          }[];
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Bill'];
        };
      };
    };
  };
  getBillsByIdActivity: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  patchBillsByIdArchive: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Bill'];
        };
      };
    };
  };
  patchBillsByIdParticipantsByMemberIdPayment: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        memberId: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          expectedStatus: components['schemas']['PaymentStatus'];
          status: components['schemas']['PaymentStatus'];
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'getBillsByIdPayment-qr-options': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postBillsByIdReminders: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  patchBillsByIdRestore: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Bill'];
        };
      };
    };
  };
  getCollections: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        provinceCode?: string;
        search?: string;
        sort?: 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';
        systemType?: CollectionSystemTypeValue | 'custom';
        type?: string;
        visibility?: 'all' | 'owned' | 'public' | 'shared';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: components['schemas']['Collection'][];
            pageInfo: {
              endCursor: string | null;
              hasNextPage: boolean;
              hasPreviousPage?: boolean;
              startCursor?: string | null;
            } & {
              [key: string]: unknown;
            };
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postCollections: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          description?: string | null;
          /** @default false */
          isPublic?: boolean;
          name: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Collection'];
        };
      };
    };
  };
  getCollectionsById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Collection'];
        };
      };
    };
  };
  putCollectionsById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          description?: string | null;
          /** @default false */
          isPublic?: boolean;
          name?: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Collection'];
        };
      };
    };
  };
  deleteCollectionsById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getCollectionsByIdRestaurants: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        provinceCode?: string;
        search?: string;
        sort?: 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';
        systemType?: CollectionSystemTypeValue | 'custom';
        type?: string;
        visibility?: 'all' | 'owned' | 'public' | 'shared';
      };
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postCollectionsByIdRestaurantsByRestaurantId: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        restaurantId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  deleteCollectionsByIdRestaurantsByRestaurantId: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        restaurantId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getCollectionsByIdShares: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        provinceCode?: string;
        search?: string;
        sort?: 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';
        systemType?: CollectionSystemTypeValue | 'custom';
        type?: string;
        visibility?: 'all' | 'owned' | 'public' | 'shared';
      };
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postCollectionsByIdShares: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          userId: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  deleteCollectionsByIdSharesByUserId: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
        userId: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getCuisines: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        provinceCode?: string;
        search?: string;
        sort?: 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';
        systemType?: CollectionSystemTypeValue | 'custom';
        type?: string;
        visibility?: 'all' | 'owned' | 'public' | 'shared';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postCuisines: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          description?: string | null;
          name: string;
          type: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  putCuisinesById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          description?: string | null;
          name: string;
          type: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  deleteCuisinesById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'getDining-areas': {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
        provinceCode?: string;
        search?: string;
        sort?: 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';
        systemType?: CollectionSystemTypeValue | 'custom';
        type?: string;
        visibility?: 'all' | 'owned' | 'public' | 'shared';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postDining-areas': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          address: string;
          addressLine?: string | null;
          description?: string | null;
          name: string;
          provinceCode?: string | null;
          provinceName?: string | null;
          wardCode?: string | null;
          wardName?: string | null;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'putDining-areasById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          address?: string;
          addressLine?: string | null;
          description?: string | null;
          name?: string;
          provinceCode?: string | null;
          provinceName?: string | null;
          wardCode?: string | null;
          wardName?: string | null;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'deleteDining-areasById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  putFeedbackById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          comment?: string | null;
          foodRating: number;
          serviceRating: number;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  deleteFeedbackById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @enum {boolean} */
            ok: true;
          };
        };
      };
    };
  };
  getMe: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['User'];
        };
      };
    };
  };
  putMeAvatar: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': unknown;
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  deleteMeAvatar: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'getMeNotification-preferences': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'patchMeNotification-preferences': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          paymentRemindersEnabled: boolean;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  patchMePassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          confirmation: string;
          currentPassword: string;
          newPassword: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'getMePayment-qr-images': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postMePayment-qr-images': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': unknown;
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'deleteMePayment-qr-imagesById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'patchMePayment-qr-imagesById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': unknown;
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postMePayment-qr-imagesByIdReplacement': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': unknown;
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  putMeProfile: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          name?: string;
          phone?: string | ('null' | null);
          username?: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['User'];
        };
      };
    };
  };
  getMembers: {
    parameters: {
      query?: {
        cursor?: string;
        direction?: 'forward' | 'backward';
        limit?: number;
        search?: string;
        sort?: 'name-asc' | 'name-desc' | 'created-desc';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: components['schemas']['User'][];
            pageInfo: {
              endCursor: string | null;
              hasNextPage: boolean;
              hasPreviousPage?: boolean;
              startCursor?: string | null;
            } & {
              [key: string]: unknown;
            };
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getNotifications: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  patchNotificationsByIdRead: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'patchNotificationsRead-all': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'getParticipant-groups': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'postParticipant-groups': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          memberIds: string[];
          name: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'putParticipant-groupsById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          memberIds: string[];
          name: string;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'deleteParticipant-groupsById': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getReady: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @enum {string} */
            database: 'ready';
            /** @enum {boolean} */
            ok: true;
          };
        };
      };
      /** @description Default Response */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @enum {string} */
            database: 'unavailable';
            /** @enum {boolean} */
            ok: false;
          };
        };
      };
    };
  };
  getRestaurants: {
    parameters: {
      query?: {
        archive?: 'active' | 'archived' | 'all';
        collectionId?: string;
        cuisineId?: string;
        cursor?: string;
        diningAreaId?: string;
        direction?: 'forward' | 'backward';
        favorite?: 'true' | 'false';
        limit?: number;
        platform?: components['schemas']['RestaurantPlatform'];
        primaryCuisineId?: string;
        recommended?: 'true' | 'false';
        search?: string;
        sort?: 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: components['schemas']['RestaurantEntry'][];
            pageInfo: {
              endCursor: string | null;
              hasNextPage: boolean;
              hasPreviousPage?: boolean;
              startCursor?: string | null;
            } & {
              [key: string]: unknown;
            };
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postRestaurants: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          address: string;
          addressLine?: string | null;
          avatarUrl?: string;
          bannerImageUrl?: string | '' | ('null' | null);
          collectionIds?: string[];
          cuisineIds?: string[];
          cuisineType?: string;
          diningAreaId?: string | null;
          isFavorite?: boolean;
          isRecommended?: boolean;
          links?: {
            label?: string;
            /** Format: uri */
            url: string;
          }[];
          name: string;
          phone?: string | ('null' | null);
          platformLinks?: {
            label?: string | null;
            platform: components['schemas']['RestaurantPlatform'];
            /** Format: uri */
            url: string;
          }[];
          primaryCuisineId?: string;
          provinceCode?: string | null;
          provinceName?: string | null;
          type: string;
          wardCode?: string | null;
          wardName?: string | null;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RestaurantEntry'];
        };
      };
    };
  };
  getRestaurantsById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RestaurantEntry'];
        };
      };
    };
  };
  putRestaurantsById: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          address?: string;
          addressLine?: string | null;
          avatarUrl?: string;
          bannerImageUrl?: string | '' | ('null' | null);
          collectionIds?: string[];
          cuisineIds?: string[];
          cuisineType?: string;
          diningAreaId?: string | null;
          isFavorite?: boolean;
          isRecommended?: boolean;
          links?: {
            label?: string;
            /** Format: uri */
            url: string;
          }[];
          name?: string;
          phone?: string | ('null' | null);
          platformLinks?: {
            label?: string | null;
            platform: components['schemas']['RestaurantPlatform'];
            /** Format: uri */
            url: string;
          }[];
          primaryCuisineId?: string;
          provinceCode?: string | null;
          provinceName?: string | null;
          type?: string;
          wardCode?: string | null;
          wardName?: string | null;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RestaurantEntry'];
        };
      };
    };
  };
  patchRestaurantsByIdArchive: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RestaurantEntry'];
        };
      };
    };
  };
  putRestaurantsByIdBanner: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': unknown;
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  deleteRestaurantsByIdBanner: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  putRestaurantsByIdCollections: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          collectionIds: string[];
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  postRestaurantsByIdFavorite: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getRestaurantsByIdFeedback: {
    parameters: {
      query?: {
        cursor?: string;
        limit?: number;
      };
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  putRestaurantsByIdLogo: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': unknown;
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  deleteRestaurantsByIdLogo: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  patchRestaurantsByIdRecommend: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RestaurantEntry'];
        };
      };
    };
  };
  patchRestaurantsByIdRestore: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RestaurantEntry'];
        };
      };
    };
  };
  getStatsMe: {
    parameters: {
      query?: {
        from?: string;
        range?: 'weekly' | 'monthly' | 'yearly' | 'custom';
        to?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  getUsers: {
    parameters: {
      query?: {
        cursor?: string;
        direction?: 'forward' | 'backward';
        limit?: number;
        search?: string;
        sort?: 'name-asc' | 'name-desc' | 'created-desc';
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: components['schemas']['User'][];
            pageInfo: {
              endCursor: string | null;
              hasNextPage: boolean;
              hasPreviousPage?: boolean;
              startCursor?: string | null;
            } & {
              [key: string]: unknown;
            };
          } & {
            [key: string]: unknown;
          };
        };
      };
    };
  };
  'patchUsersByIdChef-role': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          chefRole: components['schemas']['ChefRole'] | null;
        };
      };
    };
    responses: {
      /** @description Default Response */
      '2XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': unknown;
        };
      };
      /** @description Default Response */
      '4XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      '5XX': {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            code?: string;
            message: string;
          } & {
            [key: string]: unknown;
          };
        };
      };
      /** @description Default Response */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['User'];
        };
      };
    };
  };
}
